-- ============================================================================
-- MIGRACIÓN: triggers que faltaban en el esquema base (gdt-suite-dev)
--
-- QUÉ ES ESTO Y QUÉ NO
--   El esquema de gdt-suite-dev se copió con
--     pg_dump --schema=public --schema-only --no-owner --no-privileges
--   y eso deja afuera todo lo que vive FUERA del esquema `public`. Consecuencia:
--   en dev un usuario nuevo existe en auth.users pero NO tiene fila en
--   `perfiles`, y crear un local falla con
--     insert or update on table "locales" violates foreign key constraint
--     "locales_creado_por_fkey"          (locales.creado_por -> perfiles.id)
--
-- PROCEDENCIA (leer antes de aplicar):
--   * Las CUATRO funciones de abajo están copiadas TEXTUALMENTE de schema.sql
--     (volcado de producción, pg_dump 18.6 sobre Postgres 17.6): NO son una
--     reconstrucción. Se indica la línea de schema.sql de cada una.
--   * Los tres triggers sobre tablas de `public` (trg_crear_prueba_si_no_existe,
--     trg_marcar_revertida, trg_proteger_rol_global) también salen de schema.sql
--     (nombre, tabla, momento). Probablemente YA existen en dev, porque el dump
--     de `public` los incluye; se vuelven a declarar acá solo para que el
--     resultado no dependa de eso. Si ya están, este script no cambia nada.
--   * LO ÚNICO RECONSTRUIDO es el trigger sobre auth.users (on_auth_user_created):
--     no puede estar en un dump de `public`, así que no hay definición verificada.
--     Se infirió: nombre = el que cita pages/registro.js; función = la
--     public.handle_new_user() del dump (que existe y es de tipo trigger);
--     momento = AFTER INSERT FOR EACH ROW (el patrón estándar de Supabase y el
--     único coherente con el cuerpo de la función). NO está verificado contra
--     producción: correr antes la consulta de diagnóstico del final.
--
-- NO se tocan RLS ni constraints. Idempotente: se puede correr más de una vez.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) on_auth_user_created  — CAUSA RAÍZ DEL FK ERROR
--    Cada alta en auth.users crea su fila en public.perfiles, tomando el nombre
--    de raw_user_meta_data->>'nombre' (lo manda pages/registro.js en
--    signUp options.data). Sin esto, ningún usuario nuevo tiene perfil.
--    Función: schema.sql línea 274 (textual).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.perfiles (id, email, nombre, rol_global)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'owner'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2) trg_crear_prueba_si_no_existe  — prueba gratuita de 30 días
--    Al crear el primer local de una cuenta se crea su fila en
--    suscripciones_cuenta (on conflict do nothing: un 2º o 3º local no reinicia
--    la prueba). Lo cita pages/locales.js y lib/services/suscripciones.js.
--    Función: schema.sql línea 216 (textual).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_prueba_si_no_existe() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into suscripciones_cuenta (owner_id, plan, estado, fecha_vencimiento)
  values (new.creado_por, 'trial', 'active', (now() + interval '30 days')::date)
  on conflict (owner_id) do nothing;
  return new;
end $$;

DROP TRIGGER IF EXISTS trg_crear_prueba_si_no_existe ON public.locales;
CREATE TRIGGER trg_crear_prueba_si_no_existe
  AFTER INSERT ON public.locales
  FOR EACH ROW EXECUTE FUNCTION public.crear_prueba_si_no_existe();

-- ----------------------------------------------------------------------------
-- 3) trg_marcar_revertida  — "nada se borra": la original queda marcada
--    Al insertar una reversa (es_reversa + reversa_de), la transacción original
--    queda `revertida = true`. Lo cita lib/services/transacciones.js.
--    OJO: MIGRACION_HARDENING_P0_3_REVERSA.sql solo agrega el índice único
--    tx_una_reversa_por_original; no define este trigger.
--    Función: schema.sql línea 314 (textual).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marcar_revertida() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.es_reversa and new.reversa_de is not null then
    update transacciones set revertida = true where id = new.reversa_de;
  end if;
  return new;
end $$;

DROP TRIGGER IF EXISTS trg_marcar_revertida ON public.transacciones;
CREATE TRIGGER trg_marcar_revertida
  AFTER INSERT ON public.transacciones
  FOR EACH ROW EXECUTE FUNCTION public.marcar_revertida();

-- ----------------------------------------------------------------------------
-- 4) trg_proteger_rol_global  — solo un super_user cambia perfiles.rol_global
--    Con sesión de usuario real (auth.uid() no nulo) y sin ser super_user, el
--    cambio se rechaza. Lo cita lib/services/superadmin.js. Depende de
--    public.es_super_user() (ya existe en el dump).
--    Función: schema.sql línea 345 (textual).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_rol_global() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.rol_global is distinct from old.rol_global
     and auth.uid() is not null          -- sesión de usuario real
     and not es_super_user() then
    raise exception 'No podés cambiar rol_global';
  end if;
  return new;
end $$;

DROP TRIGGER IF EXISTS trg_proteger_rol_global ON public.perfiles;
CREATE TRIGGER trg_proteger_rol_global
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_rol_global();

-- ----------------------------------------------------------------------------
-- 5) Relleno de perfiles de usuarios que YA existían sin perfil (pensado para dev)
--    El trigger del punto 1 solo actúa sobre altas futuras. Los usuarios creados
--    antes (por ejemplo la cuenta de super admin de dev) siguen sin perfil y
--    seguirían fallando con el FK error. Mismo criterio que handle_new_user().
--    En producción no inserta nada (todos tienen perfil). Si el esquema de dev
--    tiene otras columnas NOT NULL en perfiles, este INSERT lo dirá.
-- ----------------------------------------------------------------------------
INSERT INTO public.perfiles (id, email, nombre, rol_global)
SELECT u.id,
       u.email,
       coalesce(u.raw_user_meta_data->>'nombre', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       'owner'
  FROM auth.users u
 WHERE NOT EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================================
-- DIAGNÓSTICO — NO es parte de la migración. Correr en PRODUCCIÓN
-- (chllaapjayfcuekdzltb) ANTES de aplicar nada, para confirmar que lo de arriba
-- coincide con lo real. Los nombres de trigger son los de schema.sql (con
-- prefijo trg_), no los que citan los comentarios del código.
--
-- SELECT t.tgname, c.relnamespace::regnamespace AS esquema, c.relname AS tabla,
--        pg_get_triggerdef(t.oid) AS trigger_def,
--        pg_get_functiondef(p.oid) AS funcion_def
--   FROM pg_trigger t
--   JOIN pg_class c ON c.oid = t.tgrelid
--   JOIN pg_proc  p ON p.oid = t.tgfoid
--  WHERE NOT t.tgisinternal
--    AND t.tgname IN ('on_auth_user_created', 'trg_crear_prueba_si_no_existe',
--                     'trg_marcar_revertida', 'trg_proteger_rol_global');
--
-- Lo decisivo es la fila de on_auth_user_created: confirmar que es
-- AFTER INSERT ON auth.users y que ejecuta public.handle_new_user(). Si el
-- nombre o el momento difieren, ajustar el punto 1 antes de aplicarlo.
--
-- Verificación de punta a punta en dev (después de aplicar): dar de alta un
-- usuario nuevo (registro o Auth > Add user) y comprobar que aparece en
--   SELECT id, email, nombre, rol_global FROM public.perfiles ORDER BY email;
-- y que crear un local con ese usuario ya no da el FK error.
--
-- (Opcional, NO incluido arriba) rls_auto_enable(): el dump trae la FUNCIÓN
-- public.rls_auto_enable() (event trigger que activa RLS en tablas nuevas de
-- public) pero no el EVENT TRIGGER que la invoca, porque los event triggers son
-- de la base y no de un esquema. No se pudo confirmar su nombre ni si existe en
-- dev; crearlo requiere permisos que el SQL Editor puede no tener. Confirmar en
-- prod con:  SELECT evtname, evtevent, evtenabled FROM pg_event_trigger;
-- ============================================================================

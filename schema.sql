--
-- PostgreSQL database dump
--

\restrict eHt6sgcCngM6zbu4RfaYdt6wlI5FSk5oXPYiOOzxH9lyXBmlspRkgfbonPnxCCD

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: aceptar_invitacion(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aceptar_invitacion(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_inv invitaciones%rowtype;
  v_user uuid := auth.uid();
  v_user_email text;
  v_rol_existente text;
  v_rol_final text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'Necesitás iniciar sesión');
  end if;

  select * into v_inv from invitaciones where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'La invitación no existe');
  end if;
  if v_inv.estado <> 'pendiente' then
    return jsonb_build_object('ok', false, 'error', 'La invitación ya fue usada');
  end if;
  if v_inv.expira_en < now() then
    update invitaciones set estado = 'expirada' where id = v_inv.id;
    return jsonb_build_object('ok', false, 'error', 'La invitación venció. Pedí una nueva.');
  end if;

  select email into v_user_email from auth.users where id = v_user;
  if v_user_email is null or lower(trim(v_user_email)) <> lower(trim(v_inv.email_invitado)) then
    return jsonb_build_object('ok', false, 'error',
      format('Esta invitación fue enviada a %s. Cerrá sesión o usá esa cuenta.', v_inv.email_invitado));
  end if;

  select rol into v_rol_existente
  from miembros_locales
  where user_id = v_user and local_id <> v_inv.local_id and activo = true
  limit 1;

  v_rol_final := coalesce(v_rol_existente, v_inv.rol);

  insert into miembros_locales (local_id, user_id, rol, activo, invitado_por, aceptado_en)
  values (v_inv.local_id, v_user, v_rol_final, true, v_inv.invitado_por, now())
  on conflict (local_id, user_id)
  do update set rol = excluded.rol, activo = true, aceptado_en = now();

  update invitaciones set estado = 'aceptada' where id = v_inv.id;

  insert into logs_auditoria (local_id, user_id, accion, detalles)
  values (v_inv.local_id, v_user, 'INVITACION_ACEPTADA',
          jsonb_build_object('rol', v_rol_final, 'rol_invitado', v_inv.rol));

  return jsonb_build_object(
    'ok', true, 'local_id', v_inv.local_id, 'rol', v_rol_final,
    'rol_ajustado', (v_rol_existente is not null and v_rol_existente <> v_inv.rol)
  );
end $$;


--
-- Name: calcular_financieros_transaccion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calcular_financieros_transaccion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_comision numeric;
  v_plazo integer;
  v_factor numeric;
begin
  if new.es_reversa then
    return new;
  end if;

  -- IVA: siempre a partir de monto + alicuota, nunca de lo que mande el navegador.
  v_factor := 1 + coalesce(new.alicuota_iva, 21) / 100;
  new.monto_neto := round(new.monto / v_factor, 2);
  new.monto_iva := round(new.monto - new.monto_neto, 2);

  if new.tipo = 'COBRO_RECIBIDO' and new.medio_pago_id is not null then
    select comision_porcentaje, plazo_acreditacion_dias
      into v_comision, v_plazo
      from medios_pago
      where id = new.medio_pago_id and local_id = new.local_id;

    if not found then
      raise exception 'El medio de pago no pertenece a este local'
        using errcode = 'foreign_key_violation';
    end if;

    new.comision_monto := round(new.monto * coalesce(v_comision, 0) / 100, 2);
    new.fecha_acreditacion_estimada := coalesce(new.creado_en, now())::date + coalesce(v_plazo, 0);
  else
    new.comision_monto := 0;
  end if;

  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: invitaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_invitado text NOT NULL,
    local_id uuid NOT NULL,
    rol text NOT NULL,
    invitado_por uuid NOT NULL,
    estado text DEFAULT 'pendiente'::text,
    token text NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    creado_en timestamp with time zone DEFAULT now(),
    nombre_invitado text,
    CONSTRAINT invitaciones_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aceptada'::text, 'rechazada'::text, 'expirada'::text]))),
    CONSTRAINT invitaciones_rol_check CHECK ((rol = ANY (ARRAY['cajero'::text, 'empleado'::text])))
);


--
-- Name: crear_invitacion(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_invitacion(p_local_id uuid, p_email text, p_nombre text, p_rol text) RETURNS public.invitaciones
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_email text := lower(trim(p_email));
  v_existe_miembro boolean;
  v_row invitaciones%rowtype;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Necesitás iniciar sesión' using errcode = '42501';
  end if;

  if not public.is_local_owner(p_local_id, v_user) then
    raise exception 'No tenés permiso para invitar en este local' using errcode = '42501';
  end if;

  select exists(
    select 1 from miembros_locales ml
    join perfiles p on p.id = ml.user_id
    where ml.local_id = p_local_id and ml.activo = true and lower(p.email) = v_email
  ) into v_existe_miembro;

  if v_existe_miembro then
    raise exception 'Esta persona ya forma parte del equipo' using errcode = 'P0001';
  end if;

  insert into invitaciones (local_id, email_invitado, nombre_invitado, rol, invitado_por, token, estado, expira_en)
  values (p_local_id, v_email, p_nombre, p_rol, v_user, gen_random_uuid()::text, 'pendiente', now() + interval '7 days')
  on conflict (local_id, lower(email_invitado)) where estado = 'pendiente'
  do update set
    token = case when invitaciones.expira_en < now() then excluded.token else invitaciones.token end,
    expira_en = case when invitaciones.expira_en < now() then excluded.expira_en else invitaciones.expira_en end,
    nombre_invitado = coalesce(excluded.nombre_invitado, invitaciones.nombre_invitado),
    rol = case when invitaciones.expira_en < now() then excluded.rol else invitaciones.rol end
  returning * into v_row;

  return v_row;
end $$;


--
-- Name: crear_prueba_si_no_existe(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_prueba_si_no_existe() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into suscripciones_cuenta (owner_id, plan, estado, fecha_vencimiento)
  values (new.creado_por, 'trial', 'active', (now() + interval '30 days')::date)
  on conflict (owner_id) do nothing;
  return new;
end $$;


--
-- Name: es_miembro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_miembro(p_local_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from miembros_locales
    where local_id = p_local_id and user_id = auth.uid() and activo = true
  );
$$;


--
-- Name: es_owner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_owner(p_local_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from miembros_locales
    where local_id = p_local_id and user_id = auth.uid() and activo = true and rol = 'owner'
  );
$$;


--
-- Name: es_super_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_super_user() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from perfiles where id = auth.uid() and rol_global = 'super_user');
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
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


--
-- Name: is_local_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_local_owner(check_local_id uuid, check_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM miembros_locales 
    WHERE local_id = check_local_id 
    AND user_id = check_user_id 
    AND rol = 'owner' 
    AND activo = true
  );
END;
$$;


--
-- Name: marcar_revertida(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marcar_revertida() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.es_reversa and new.reversa_de is not null then
    update transacciones set revertida = true where id = new.reversa_de;
  end if;
  return new;
end $$;


--
-- Name: marcar_webhook_mp_resultado(text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marcar_webhook_mp_resultado(p_id text, p_exito boolean, p_error text DEFAULT NULL::text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update mp_notificaciones_procesadas
  set completada_en = case when p_exito then now() else completada_en end,
      ultimo_error = p_error
  where id = p_id;
$$;


--
-- Name: proteger_rol_global(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proteger_rol_global() RETURNS trigger
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


--
-- Name: registrar_intento_webhook_mp(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_intento_webhook_mp(p_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_completada timestamptz;
begin
  insert into mp_notificaciones_procesadas (id, recibida_en, intentos)
  values (p_id, now(), 1)
  on conflict (id) do update
    set intentos = mp_notificaciones_procesadas.intentos + 1
  returning completada_en into v_completada;

  return v_completada is null;   -- true = hay que procesarla (nueva o reintento de una que había fallado)
end;
$$;


--
-- Name: registrar_log(uuid, uuid, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_log(p_local_id uuid, p_user_id uuid, p_accion text, p_detalles jsonb DEFAULT '{}'::jsonb, p_ip_address text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO logs_auditoria (local_id, user_id, accion, detalles, ip_address, creado_en)
  VALUES (p_local_id, p_user_id, p_accion, p_detalles, p_ip_address, now());
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: rol_en_local(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rol_en_local(p_local_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select rol from miembros_locales
  where local_id = p_local_id and user_id = auth.uid() and activo = true
  limit 1;
$$;


--
-- Name: rol_existente_de(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rol_existente_de(p_email text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select ml.rol
  from perfiles p
  join miembros_locales ml on ml.user_id = p.id and ml.activo = true
  where lower(p.email) = lower(trim(p_email))
  limit 1;
$$;


--
-- Name: set_creado_por(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_creado_por() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.creado_por := coalesce(new.creado_por, auth.uid());
  return new;
end $$;


--
-- Name: update_actualizado_en_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_actualizado_en_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.actualizado_en = timezone('utc'::text, now());
  return new;
end;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;


--
-- Name: validar_limite_equipo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_limite_equipo() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_segmento text;
  v_plan text;
  v_limite int;
  v_activos int;
begin
  select s.plan, s.segmento into v_plan, v_segmento
  from locales l
  join suscripciones_cuenta s on s.owner_id = l.creado_por
  where l.id = new.local_id;

  if v_plan is distinct from 'pago' or v_segmento is null then
    return new;   -- prueba, o sin cuenta paga todavía: sin límite
  end if;

  v_limite := case v_segmento when 'basico' then 1 when 'negocio' then 1 else null end;
  if v_limite is null then
    return new;   -- multi_local: sin límite de equipo
  end if;

  select count(*) into v_activos
  from miembros_locales where local_id = new.local_id and activo = true;

  if v_activos >= v_limite then
    raise exception 'Tu plan permite solo al dueño operando. Actualizá tu plan para sumar gente.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;


--
-- Name: validar_limite_locales(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_limite_locales() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_plan text;
  v_segmento text;
  v_limite int;
  v_actuales int;
begin
  select plan, segmento into v_plan, v_segmento
  from suscripciones_cuenta where owner_id = new.creado_por;

  if v_plan is distinct from 'pago' or v_segmento is null then
    return new;   -- prueba, o todavía sin cuenta: sin límite
  end if;

  v_limite := case v_segmento when 'basico' then 1 when 'negocio' then 1 else null end;
  if v_limite is null then
    return new;   -- multi_local: sin límite de locales
  end if;

  select count(*) into v_actuales from locales where creado_por = new.creado_por;
  if v_actuales >= v_limite then
    raise exception 'Tu plan permite un solo local. Actualizá a Multi-local para abrir otro.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;


--
-- Name: validar_rol_unico(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_rol_unico() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_rol_existente text;
begin
  select rol into v_rol_existente
  from miembros_locales
  where user_id = new.user_id
    and local_id <> new.local_id
    and activo = true
  limit 1;
 
  if v_rol_existente is not null and v_rol_existente <> new.rol then
    raise exception
      'Esta persona ya participa en otro local como %. Una persona tiene el mismo rol en todos sus locales.',
      v_rol_existente
      using errcode = 'check_violation';
  end if;
 
  return new;
end $$;


--
-- Name: ver_invitacion(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ver_invitacion(p_token text) RETURNS TABLE(local_nombre text, rol text, email_invitado text, nombre_invitado text, estado text, expirada boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select l.nombre, i.rol, i.email_invitado, i.nombre_invitado, i.estado, (i.expira_en < now())
  from invitaciones i
  join locales l on l.id = i.local_id
  where i.token = p_token
  limit 1;
$$;


--
-- Name: anuncios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anuncios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    mensaje text NOT NULL,
    tipo text DEFAULT 'info'::text,
    activo boolean DEFAULT true,
    creado_por uuid,
    creado_en timestamp with time zone DEFAULT now(),
    actualizado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT anuncios_tipo_check CHECK ((tipo = ANY (ARRAY['info'::text, 'warning'::text, 'success'::text, 'feature'::text, 'urgent'::text])))
);


--
-- Name: anuncios_leidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anuncios_leidos (
    anuncio_id uuid NOT NULL,
    user_id uuid NOT NULL,
    leido_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cierres_caja; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cierres_caja (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    local_id uuid NOT NULL,
    user_id uuid NOT NULL,
    fecha_apertura timestamp with time zone DEFAULT now() NOT NULL,
    fecha_cierre timestamp with time zone,
    monto_inicial_efectivo numeric(12,2) DEFAULT 0,
    total_cobrado numeric(12,2) DEFAULT 0,
    total_gastado numeric(12,2) DEFAULT 0,
    cantidad_transacciones integer DEFAULT 0,
    efectivo_fisico numeric(12,2),
    diferencia_efectivo numeric(12,2),
    observaciones text,
    estado character varying(20) DEFAULT 'abierta'::character varying,
    creado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT cierres_caja_cantidad_tx_no_negativa_check CHECK (((cantidad_transacciones IS NULL) OR (cantidad_transacciones >= 0))),
    CONSTRAINT cierres_caja_efectivo_fisico_no_negativo_check CHECK (((efectivo_fisico IS NULL) OR (efectivo_fisico >= (0)::numeric))),
    CONSTRAINT cierres_caja_estado_check CHECK (((estado)::text = ANY ((ARRAY['abierta'::character varying, 'cerrada'::character varying])::text[]))),
    CONSTRAINT cierres_caja_fechas_check CHECK (((fecha_cierre IS NULL) OR (fecha_cierre >= fecha_apertura))),
    CONSTRAINT cierres_caja_monto_inicial_no_negativo_check CHECK (((monto_inicial_efectivo IS NULL) OR (monto_inicial_efectivo >= (0)::numeric))),
    CONSTRAINT cierres_caja_totales_no_negativos_check CHECK ((((total_cobrado IS NULL) OR (total_cobrado >= (0)::numeric)) AND ((total_gastado IS NULL) OR (total_gastado >= (0)::numeric))))
);


--
-- Name: conexiones_mercadopago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conexiones_mercadopago (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    mp_user_id text NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    vence_en timestamp with time zone NOT NULL,
    conectado_en timestamp with time zone DEFAULT now() NOT NULL,
    desconectado_en timestamp with time zone,
    ultima_sincronizacion_manual timestamp with time zone
);


--
-- Name: configuracion_global; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion_global (
    id integer DEFAULT 1 NOT NULL,
    max_locales_por_usuario integer DEFAULT 10 NOT NULL,
    comision_default numeric DEFAULT 2.5 NOT NULL,
    plazo_acreditacion_default integer DEFAULT 30 NOT NULL,
    mantenimiento_activo boolean DEFAULT false NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT configuracion_global_id_check CHECK ((id = 1))
);


--
-- Name: configuracion_negocio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion_negocio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    local_id uuid NOT NULL,
    monto_maximo_cajero numeric DEFAULT 0,
    requiere_aprobacion_gastos boolean DEFAULT false,
    permitir_cajero_ver_comisiones boolean DEFAULT false,
    permitir_cajero_ver_iva boolean DEFAULT false,
    actualizado_en timestamp with time zone DEFAULT now()
);


--
-- Name: contactos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contactos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    local_id uuid,
    tipo_consulta text NOT NULL,
    asunto text NOT NULL,
    mensaje text NOT NULL,
    pagina_origen text,
    estado text DEFAULT 'pendiente'::text,
    respuesta text,
    respondido_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now()
);


--
-- Name: locales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    creado_en timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    actualizado_en timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    descripcion text,
    moneda text DEFAULT 'ARS'::text,
    zona_horaria text DEFAULT 'America/Argentina/Buenos_Aires'::text,
    rubro text,
    condicion_fiscal text,
    creado_por uuid NOT NULL,
    activo boolean DEFAULT true,
    direccion text,
    ciudad text,
    provincia text,
    codigo_postal text,
    latitud numeric,
    longitud numeric,
    CONSTRAINT locales_condicion_fiscal_check CHECK ((condicion_fiscal = ANY (ARRAY['No inscripto'::text, 'Monotributo'::text, 'Responsable Inscripto'::text])))
);


--
-- Name: logs_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logs_auditoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    local_id uuid,
    user_id uuid NOT NULL,
    accion text NOT NULL,
    tabla_afectada text,
    registro_id uuid,
    detalles jsonb,
    ip_address text,
    creado_en timestamp with time zone DEFAULT now()
);


--
-- Name: logs_auditoria_global; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logs_auditoria_global (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid NOT NULL,
    accion text NOT NULL,
    objetivo_id uuid,
    detalles jsonb,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mapeo_locales_mp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mapeo_locales_mp (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    local_id uuid NOT NULL,
    mp_store_id text NOT NULL,
    mp_pos_id text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: medios_pago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medios_pago (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    local_id uuid NOT NULL,
    nombre text,
    creado_en timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    actualizado_en timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    tipo text,
    icono text,
    comision_porcentaje numeric(5,2) DEFAULT 0,
    plazo_acreditacion_dias integer DEFAULT 0,
    habilitado boolean DEFAULT true,
    es_default boolean DEFAULT false,
    orden integer DEFAULT 0,
    creado_por uuid,
    CONSTRAINT medios_pago_comision_rango_check CHECK (((comision_porcentaje IS NULL) OR ((comision_porcentaje >= (0)::numeric) AND (comision_porcentaje <= (100)::numeric)))),
    CONSTRAINT medios_pago_plazo_no_negativo_check CHECK (((plazo_acreditacion_dias IS NULL) OR (plazo_acreditacion_dias >= 0))),
    CONSTRAINT medios_pago_tipo_check CHECK (((tipo IS NULL) OR (tipo = ANY (ARRAY['efectivo'::text, 'debito'::text, 'credito'::text, 'transferencia'::text, 'qr'::text, 'billetera_virtual'::text, 'otro'::text]))))
);


--
-- Name: miembros_locales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.miembros_locales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    local_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rol text NOT NULL,
    monto_maximo_gasto numeric,
    activo boolean DEFAULT true,
    invitado_por uuid,
    aceptado_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT miembros_locales_rol_check CHECK ((rol = ANY (ARRAY['owner'::text, 'cajero'::text, 'empleado'::text])))
);


--
-- Name: movimientos_mp_pendientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimientos_mp_pendientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    local_id uuid,
    mp_payment_id text NOT NULL,
    origen text NOT NULL,
    monto numeric NOT NULL,
    descripcion text,
    fecha_mp timestamp with time zone NOT NULL,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    transaccion_id uuid,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT movimientos_mp_pendientes_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'confirmado'::text, 'descartado'::text]))),
    CONSTRAINT movimientos_mp_pendientes_origen_check CHECK ((origen = ANY (ARRAY['point'::text, 'qr'::text, 'transferencia'::text])))
);


--
-- Name: mp_notificaciones_procesadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mp_notificaciones_procesadas (
    id text NOT NULL,
    recibida_en timestamp with time zone DEFAULT now() NOT NULL,
    completada_en timestamp with time zone,
    intentos integer DEFAULT 1 NOT NULL,
    ultimo_error text
);


--
-- Name: pagos_suscripcion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_suscripcion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    segmento text NOT NULL,
    ciclo text NOT NULL,
    monto numeric NOT NULL,
    mp_payment_id text,
    procesado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pagos_suscripcion_ciclo_check CHECK ((ciclo = ANY (ARRAY['mensual'::text, 'anual'::text]))),
    CONSTRAINT pagos_suscripcion_monto_positivo_check CHECK ((monto > (0)::numeric)),
    CONSTRAINT pagos_suscripcion_segmento_check CHECK ((segmento = ANY (ARRAY['basico'::text, 'negocio'::text, 'multi_local'::text])))
);


--
-- Name: perfiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.perfiles (
    id uuid NOT NULL,
    email text,
    nombre text,
    rol_global text DEFAULT 'owner'::text,
    creado_en timestamp with time zone DEFAULT now(),
    actualizado_en timestamp with time zone DEFAULT now(),
    bienvenida_vista_en timestamp with time zone,
    terminos_aceptados_en timestamp with time zone,
    terminos_version text,
    CONSTRAINT perfiles_rol_global_check CHECK ((rol_global = ANY (ARRAY['super_user'::text, 'owner'::text])))
);


--
-- Name: planes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    segmento text NOT NULL,
    ciclo text NOT NULL,
    precio numeric NOT NULL,
    moneda text DEFAULT 'ARS'::text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT planes_ciclo_check CHECK ((ciclo = ANY (ARRAY['mensual'::text, 'anual'::text]))),
    CONSTRAINT planes_precio_check CHECK ((precio >= (0)::numeric)),
    CONSTRAINT planes_segmento_check CHECK ((segmento = ANY (ARRAY['basico'::text, 'negocio'::text, 'multi_local'::text])))
);


--
-- Name: suscripciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suscripciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    local_id uuid NOT NULL,
    plan text DEFAULT 'free'::text,
    estado text DEFAULT 'active'::text,
    fecha_vencimiento date,
    ultimo_pago date,
    creado_en timestamp with time zone DEFAULT now(),
    actualizado_en timestamp with time zone DEFAULT now(),
    segmento text,
    ciclo text,
    mp_preapproval_id text,
    mp_payer_email text,
    CONSTRAINT suscripciones_ciclo_check CHECK ((ciclo = ANY (ARRAY['mensual'::text, 'anual'::text]))),
    CONSTRAINT suscripciones_estado_check CHECK ((estado = ANY (ARRAY['active'::text, 'restricted'::text, 'suspended'::text, 'cancelled'::text]))),
    CONSTRAINT suscripciones_segmento_check CHECK ((segmento = ANY (ARRAY['basico'::text, 'negocio'::text, 'multi_local'::text])))
);


--
-- Name: suscripciones_cuenta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suscripciones_cuenta (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    plan text DEFAULT 'trial'::text NOT NULL,
    segmento text,
    ciclo text,
    estado text DEFAULT 'active'::text NOT NULL,
    fecha_vencimiento date,
    mp_preapproval_id text,
    mp_payer_email text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    monto numeric,
    CONSTRAINT suscripciones_cuenta_ciclo_check CHECK ((ciclo = ANY (ARRAY['mensual'::text, 'anual'::text]))),
    CONSTRAINT suscripciones_cuenta_estado_check CHECK ((estado = ANY (ARRAY['active'::text, 'restricted'::text, 'suspended'::text, 'cancelled'::text]))),
    CONSTRAINT suscripciones_cuenta_plan_check CHECK ((plan = ANY (ARRAY['trial'::text, 'pago'::text]))),
    CONSTRAINT suscripciones_cuenta_segmento_check CHECK ((segmento = ANY (ARRAY['basico'::text, 'negocio'::text, 'multi_local'::text])))
);


--
-- Name: transacciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transacciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    local_id uuid,
    tipo text NOT NULL,
    monto numeric(12,2) NOT NULL,
    comision_monto numeric(12,2) DEFAULT 0,
    medio_pago_id uuid,
    estado_pago text DEFAULT 'ACREDITADO'::text,
    descripcion text,
    categoria text,
    creado_por uuid,
    creado_en timestamp with time zone DEFAULT timezone('utc'::text, now()),
    fecha_acreditacion_estimada date,
    alicuota_iva numeric DEFAULT 21,
    monto_iva numeric DEFAULT 0,
    monto_neto numeric DEFAULT 0,
    es_reversa boolean DEFAULT false,
    reversa_de uuid,
    motivo_reversa text,
    tipo_comprobante text,
    punto_venta integer,
    nro_comprobante bigint,
    revertida boolean DEFAULT false NOT NULL,
    CONSTRAINT transacciones_alicuota_check CHECK ((alicuota_iva = ANY (ARRAY[(0)::numeric, 2.5, (5)::numeric, 10.5, (21)::numeric, (27)::numeric]))),
    CONSTRAINT transacciones_componentes_mismo_signo_check CHECK ((((monto > (0)::numeric) AND (comision_monto >= (0)::numeric) AND (monto_iva >= (0)::numeric) AND (monto_neto >= (0)::numeric)) OR ((monto < (0)::numeric) AND (comision_monto <= (0)::numeric) AND (monto_iva <= (0)::numeric) AND (monto_neto <= (0)::numeric)))),
    CONSTRAINT transacciones_monto_signo_reversa_check CHECK ((((es_reversa = true) AND (monto < (0)::numeric)) OR ((es_reversa = false) AND (monto > (0)::numeric)))),
    CONSTRAINT transacciones_reversa_consistencia_check CHECK ((es_reversa = (reversa_de IS NOT NULL))),
    CONSTRAINT transacciones_tipo_check CHECK ((tipo = ANY (ARRAY['COBRO_RECIBIDO'::text, 'GASTO_REGISTRADO'::text, 'CAJA_ABIERTA'::text, 'CAJA_CERRADA'::text]))),
    CONSTRAINT transacciones_tipo_comprobante_check CHECK (((tipo_comprobante IS NULL) OR (tipo_comprobante = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'M'::text, 'TICKET'::text, 'SIN_COMPROBANTE'::text]))))
);


--
-- Name: anuncios_leidos anuncios_leidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anuncios_leidos
    ADD CONSTRAINT anuncios_leidos_pkey PRIMARY KEY (anuncio_id, user_id);


--
-- Name: anuncios anuncios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anuncios
    ADD CONSTRAINT anuncios_pkey PRIMARY KEY (id);


--
-- Name: cierres_caja cierres_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_caja
    ADD CONSTRAINT cierres_caja_pkey PRIMARY KEY (id);


--
-- Name: conexiones_mercadopago conexiones_mercadopago_owner_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conexiones_mercadopago
    ADD CONSTRAINT conexiones_mercadopago_owner_id_key UNIQUE (owner_id);


--
-- Name: conexiones_mercadopago conexiones_mercadopago_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conexiones_mercadopago
    ADD CONSTRAINT conexiones_mercadopago_pkey PRIMARY KEY (id);


--
-- Name: configuracion_global configuracion_global_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_global
    ADD CONSTRAINT configuracion_global_pkey PRIMARY KEY (id);


--
-- Name: configuracion_negocio configuracion_negocio_local_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_negocio
    ADD CONSTRAINT configuracion_negocio_local_id_key UNIQUE (local_id);


--
-- Name: configuracion_negocio configuracion_negocio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_negocio
    ADD CONSTRAINT configuracion_negocio_pkey PRIMARY KEY (id);


--
-- Name: contactos contactos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT contactos_pkey PRIMARY KEY (id);


--
-- Name: invitaciones invitaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitaciones
    ADD CONSTRAINT invitaciones_pkey PRIMARY KEY (id);


--
-- Name: invitaciones invitaciones_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitaciones
    ADD CONSTRAINT invitaciones_token_key UNIQUE (token);


--
-- Name: logs_auditoria_global logs_auditoria_global_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_auditoria_global
    ADD CONSTRAINT logs_auditoria_global_pkey PRIMARY KEY (id);


--
-- Name: logs_auditoria logs_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_auditoria
    ADD CONSTRAINT logs_auditoria_pkey PRIMARY KEY (id);


--
-- Name: mapeo_locales_mp mapeo_locales_mp_local_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapeo_locales_mp
    ADD CONSTRAINT mapeo_locales_mp_local_id_key UNIQUE (local_id);


--
-- Name: mapeo_locales_mp mapeo_locales_mp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapeo_locales_mp
    ADD CONSTRAINT mapeo_locales_mp_pkey PRIMARY KEY (id);


--
-- Name: miembros_locales miembros_locales_local_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.miembros_locales
    ADD CONSTRAINT miembros_locales_local_id_user_id_key UNIQUE (local_id, user_id);


--
-- Name: miembros_locales miembros_locales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.miembros_locales
    ADD CONSTRAINT miembros_locales_pkey PRIMARY KEY (id);


--
-- Name: movimientos_mp_pendientes movimientos_mp_pendientes_owner_id_mp_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_mp_pendientes
    ADD CONSTRAINT movimientos_mp_pendientes_owner_id_mp_payment_id_key UNIQUE (owner_id, mp_payment_id);


--
-- Name: movimientos_mp_pendientes movimientos_mp_pendientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_mp_pendientes
    ADD CONSTRAINT movimientos_mp_pendientes_pkey PRIMARY KEY (id);


--
-- Name: mp_notificaciones_procesadas mp_notificaciones_procesadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mp_notificaciones_procesadas
    ADD CONSTRAINT mp_notificaciones_procesadas_pkey PRIMARY KEY (id);


--
-- Name: pagos_suscripcion pagos_suscripcion_mp_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_suscripcion
    ADD CONSTRAINT pagos_suscripcion_mp_payment_id_key UNIQUE (mp_payment_id);


--
-- Name: pagos_suscripcion pagos_suscripcion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_suscripcion
    ADD CONSTRAINT pagos_suscripcion_pkey PRIMARY KEY (id);


--
-- Name: medios_pago payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medios_pago
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: perfiles perfiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles
    ADD CONSTRAINT perfiles_pkey PRIMARY KEY (id);


--
-- Name: planes planes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planes
    ADD CONSTRAINT planes_pkey PRIMARY KEY (id);


--
-- Name: planes planes_segmento_ciclo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planes
    ADD CONSTRAINT planes_segmento_ciclo_key UNIQUE (segmento, ciclo);


--
-- Name: suscripciones_cuenta suscripciones_cuenta_owner_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suscripciones_cuenta
    ADD CONSTRAINT suscripciones_cuenta_owner_id_key UNIQUE (owner_id);


--
-- Name: suscripciones_cuenta suscripciones_cuenta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suscripciones_cuenta
    ADD CONSTRAINT suscripciones_cuenta_pkey PRIMARY KEY (id);


--
-- Name: suscripciones suscripciones_local_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suscripciones
    ADD CONSTRAINT suscripciones_local_id_key UNIQUE (local_id);


--
-- Name: suscripciones suscripciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suscripciones
    ADD CONSTRAINT suscripciones_pkey PRIMARY KEY (id);


--
-- Name: transacciones transacciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transacciones
    ADD CONSTRAINT transacciones_pkey PRIMARY KEY (id);


--
-- Name: locales workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locales
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: cierres_caja_una_abierta_por_local; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cierres_caja_una_abierta_por_local ON public.cierres_caja USING btree (local_id) WHERE ((estado)::text = 'abierta'::text);


--
-- Name: cierres_local_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cierres_local_estado_idx ON public.cierres_caja USING btree (local_id, estado, fecha_apertura DESC);


--
-- Name: idx_anuncios_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anuncios_activo ON public.anuncios USING btree (activo) WHERE (activo = true);


--
-- Name: idx_cierres_caja_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cierres_caja_estado ON public.cierres_caja USING btree (estado);


--
-- Name: idx_cierres_caja_fecha_apertura; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cierres_caja_fecha_apertura ON public.cierres_caja USING btree (fecha_apertura);


--
-- Name: idx_cierres_caja_local_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cierres_caja_local_id ON public.cierres_caja USING btree (local_id);


--
-- Name: idx_cierres_caja_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cierres_caja_user_id ON public.cierres_caja USING btree (user_id);


--
-- Name: idx_contactos_creado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_creado ON public.contactos USING btree (creado_en DESC);


--
-- Name: idx_contactos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_estado ON public.contactos USING btree (estado);


--
-- Name: idx_contactos_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_user ON public.contactos USING btree (user_id);


--
-- Name: idx_locales_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locales_activo ON public.locales USING btree (activo);


--
-- Name: idx_locales_creado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locales_creado_por ON public.locales USING btree (creado_por);


--
-- Name: idx_payment_methods_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_workspace_id ON public.medios_pago USING btree (local_id);


--
-- Name: idx_transacciones_reversa_de; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transacciones_reversa_de ON public.transacciones USING btree (reversa_de);


--
-- Name: invitaciones_pendiente_unica; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invitaciones_pendiente_unica ON public.invitaciones USING btree (local_id, lower(email_invitado)) WHERE (estado = 'pendiente'::text);


--
-- Name: logs_local_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX logs_local_fecha_idx ON public.logs_auditoria USING btree (local_id, creado_en DESC);


--
-- Name: miembros_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX miembros_user_idx ON public.miembros_locales USING btree (user_id) WHERE activo;


--
-- Name: tx_local_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tx_local_fecha_idx ON public.transacciones USING btree (local_id, creado_en DESC);


--
-- Name: tx_reversa_de_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tx_reversa_de_idx ON public.transacciones USING btree (reversa_de) WHERE (reversa_de IS NOT NULL);


--
-- Name: tx_una_reversa_por_original; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tx_una_reversa_por_original ON public.transacciones USING btree (reversa_de) WHERE (reversa_de IS NOT NULL);


--
-- Name: transacciones trg_calcular_financieros_transaccion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_calcular_financieros_transaccion BEFORE INSERT ON public.transacciones FOR EACH ROW EXECUTE FUNCTION public.calcular_financieros_transaccion();


--
-- Name: locales trg_crear_prueba_si_no_existe; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_crear_prueba_si_no_existe AFTER INSERT ON public.locales FOR EACH ROW EXECUTE FUNCTION public.crear_prueba_si_no_existe();


--
-- Name: locales trg_locales_actualizado_en; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_locales_actualizado_en BEFORE UPDATE ON public.locales FOR EACH ROW EXECUTE FUNCTION public.update_actualizado_en_column();


--
-- Name: transacciones trg_marcar_revertida; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_marcar_revertida AFTER INSERT ON public.transacciones FOR EACH ROW EXECUTE FUNCTION public.marcar_revertida();


--
-- Name: medios_pago trg_medios_pago_actualizado_en; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_medios_pago_actualizado_en BEFORE UPDATE ON public.medios_pago FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: perfiles trg_proteger_rol_global; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_proteger_rol_global BEFORE UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION public.proteger_rol_global();


--
-- Name: transacciones trg_tx_creado_por; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tx_creado_por BEFORE INSERT ON public.transacciones FOR EACH ROW EXECUTE FUNCTION public.set_creado_por();


--
-- Name: miembros_locales trg_validar_limite_equipo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_limite_equipo BEFORE INSERT ON public.miembros_locales FOR EACH ROW EXECUTE FUNCTION public.validar_limite_equipo();


--
-- Name: locales trg_validar_limite_locales; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_limite_locales BEFORE INSERT ON public.locales FOR EACH ROW EXECUTE FUNCTION public.validar_limite_locales();


--
-- Name: miembros_locales trg_validar_rol_unico; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_rol_unico BEFORE INSERT OR UPDATE OF rol, activo ON public.miembros_locales FOR EACH ROW EXECUTE FUNCTION public.validar_rol_unico();


--
-- Name: anuncios anuncios_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anuncios
    ADD CONSTRAINT anuncios_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: anuncios_leidos anuncios_leidos_anuncio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anuncios_leidos
    ADD CONSTRAINT anuncios_leidos_anuncio_id_fkey FOREIGN KEY (anuncio_id) REFERENCES public.anuncios(id) ON DELETE CASCADE;


--
-- Name: anuncios_leidos anuncios_leidos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anuncios_leidos
    ADD CONSTRAINT anuncios_leidos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.perfiles(id) ON DELETE CASCADE;


--
-- Name: cierres_caja cierres_caja_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_caja
    ADD CONSTRAINT cierres_caja_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id) ON DELETE CASCADE;


--
-- Name: cierres_caja cierres_caja_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_caja
    ADD CONSTRAINT cierres_caja_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.perfiles(id) ON DELETE CASCADE;


--
-- Name: conexiones_mercadopago conexiones_mercadopago_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conexiones_mercadopago
    ADD CONSTRAINT conexiones_mercadopago_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.perfiles(id);


--
-- Name: configuracion_negocio configuracion_negocio_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_negocio
    ADD CONSTRAINT configuracion_negocio_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id) ON DELETE CASCADE;


--
-- Name: contactos contactos_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT contactos_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id) ON DELETE SET NULL;


--
-- Name: contactos contactos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT contactos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: invitaciones invitaciones_invitado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitaciones
    ADD CONSTRAINT invitaciones_invitado_por_fkey FOREIGN KEY (invitado_por) REFERENCES auth.users(id);


--
-- Name: invitaciones invitaciones_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitaciones
    ADD CONSTRAINT invitaciones_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id) ON DELETE CASCADE;


--
-- Name: locales locales_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locales
    ADD CONSTRAINT locales_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.perfiles(id);


--
-- Name: logs_auditoria_global logs_auditoria_global_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_auditoria_global
    ADD CONSTRAINT logs_auditoria_global_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.perfiles(id);


--
-- Name: logs_auditoria_global logs_auditoria_global_objetivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_auditoria_global
    ADD CONSTRAINT logs_auditoria_global_objetivo_id_fkey FOREIGN KEY (objetivo_id) REFERENCES public.perfiles(id);


--
-- Name: logs_auditoria logs_auditoria_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_auditoria
    ADD CONSTRAINT logs_auditoria_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id) ON DELETE CASCADE;


--
-- Name: logs_auditoria logs_auditoria_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_auditoria
    ADD CONSTRAINT logs_auditoria_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: mapeo_locales_mp mapeo_locales_mp_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapeo_locales_mp
    ADD CONSTRAINT mapeo_locales_mp_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id);


--
-- Name: medios_pago medios_pago_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medios_pago
    ADD CONSTRAINT medios_pago_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES auth.users(id);


--
-- Name: miembros_locales miembros_locales_invitado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.miembros_locales
    ADD CONSTRAINT miembros_locales_invitado_por_fkey FOREIGN KEY (invitado_por) REFERENCES auth.users(id);


--
-- Name: miembros_locales miembros_locales_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.miembros_locales
    ADD CONSTRAINT miembros_locales_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id) ON DELETE CASCADE;


--
-- Name: miembros_locales miembros_locales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.miembros_locales
    ADD CONSTRAINT miembros_locales_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.perfiles(id);


--
-- Name: movimientos_mp_pendientes movimientos_mp_pendientes_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_mp_pendientes
    ADD CONSTRAINT movimientos_mp_pendientes_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id);


--
-- Name: movimientos_mp_pendientes movimientos_mp_pendientes_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_mp_pendientes
    ADD CONSTRAINT movimientos_mp_pendientes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.perfiles(id);


--
-- Name: movimientos_mp_pendientes movimientos_mp_pendientes_transaccion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_mp_pendientes
    ADD CONSTRAINT movimientos_mp_pendientes_transaccion_id_fkey FOREIGN KEY (transaccion_id) REFERENCES public.transacciones(id);


--
-- Name: pagos_suscripcion pagos_suscripcion_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_suscripcion
    ADD CONSTRAINT pagos_suscripcion_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.perfiles(id);


--
-- Name: medios_pago payment_methods_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medios_pago
    ADD CONSTRAINT payment_methods_workspace_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id) ON DELETE CASCADE;


--
-- Name: perfiles perfiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles
    ADD CONSTRAINT perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: suscripciones_cuenta suscripciones_cuenta_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suscripciones_cuenta
    ADD CONSTRAINT suscripciones_cuenta_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.perfiles(id);


--
-- Name: suscripciones suscripciones_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suscripciones
    ADD CONSTRAINT suscripciones_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id);


--
-- Name: transacciones transacciones_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transacciones
    ADD CONSTRAINT transacciones_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES auth.users(id);


--
-- Name: transacciones transacciones_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transacciones
    ADD CONSTRAINT transacciones_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id) ON DELETE CASCADE;


--
-- Name: transacciones transacciones_medio_pago_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transacciones
    ADD CONSTRAINT transacciones_medio_pago_id_fkey FOREIGN KEY (medio_pago_id) REFERENCES public.medios_pago(id) ON DELETE SET NULL;


--
-- Name: transacciones transacciones_reversa_de_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transacciones
    ADD CONSTRAINT transacciones_reversa_de_fkey FOREIGN KEY (reversa_de) REFERENCES public.transacciones(id);


--
-- Name: locales Permitir crear locales al dueño; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir crear locales al dueño" ON public.locales FOR INSERT TO authenticated WITH CHECK ((auth.uid() = creado_por));


--
-- Name: locales Permitir leer locales propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leer locales propios" ON public.locales FOR SELECT TO authenticated USING ((auth.uid() = creado_por));


--
-- Name: anuncios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;

--
-- Name: anuncios_leidos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anuncios_leidos ENABLE ROW LEVEL SECURITY;

--
-- Name: anuncios_leidos anuncios_leidos_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anuncios_leidos_own ON public.anuncios_leidos TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: anuncios anuncios_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anuncios_select ON public.anuncios FOR SELECT TO authenticated USING (((activo = true) OR public.es_super_user()));


--
-- Name: anuncios anuncios_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anuncios_write ON public.anuncios TO authenticated USING (public.es_super_user()) WITH CHECK (public.es_super_user());


--
-- Name: configuracion_global cfg_global_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cfg_global_select ON public.configuracion_global FOR SELECT TO authenticated USING (true);


--
-- Name: configuracion_global cfg_global_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cfg_global_write ON public.configuracion_global TO authenticated USING (public.es_super_user()) WITH CHECK (public.es_super_user());


--
-- Name: cierres_caja; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cierres_caja ENABLE ROW LEVEL SECURITY;

--
-- Name: cierres_caja cierres_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cierres_insert ON public.cierres_caja FOR INSERT TO authenticated WITH CHECK ((public.rol_en_local(local_id) = ANY (ARRAY['owner'::text, 'cajero'::text])));


--
-- Name: cierres_caja cierres_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cierres_select ON public.cierres_caja FOR SELECT TO authenticated USING ((public.es_miembro(local_id) OR public.es_super_user()));


--
-- Name: cierres_caja cierres_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cierres_update ON public.cierres_caja FOR UPDATE TO authenticated USING ((public.rol_en_local(local_id) = ANY (ARRAY['owner'::text, 'cajero'::text]))) WITH CHECK ((public.rol_en_local(local_id) = ANY (ARRAY['owner'::text, 'cajero'::text])));


--
-- Name: conexiones_mercadopago; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conexiones_mercadopago ENABLE ROW LEVEL SECURITY;

--
-- Name: conexiones_mercadopago conexiones_mercadopago_sin_acceso_cliente; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conexiones_mercadopago_sin_acceso_cliente ON public.conexiones_mercadopago TO authenticated USING (false) WITH CHECK (false);


--
-- Name: configuracion_negocio config_negocio_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY config_negocio_select ON public.configuracion_negocio FOR SELECT TO authenticated USING (public.es_miembro(local_id));


--
-- Name: configuracion_negocio config_negocio_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY config_negocio_write ON public.configuracion_negocio TO authenticated USING (public.es_owner(local_id)) WITH CHECK (public.es_owner(local_id));


--
-- Name: configuracion_global; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracion_global ENABLE ROW LEVEL SECURITY;

--
-- Name: configuracion_negocio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracion_negocio ENABLE ROW LEVEL SECURITY;

--
-- Name: contactos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contactos ENABLE ROW LEVEL SECURITY;

--
-- Name: contactos contactos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contactos_insert ON public.contactos FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: contactos contactos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contactos_select ON public.contactos FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.es_super_user()));


--
-- Name: contactos contactos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contactos_update ON public.contactos FOR UPDATE TO authenticated USING (public.es_super_user()) WITH CHECK (public.es_super_user());


--
-- Name: invitaciones inv_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inv_all ON public.invitaciones TO authenticated USING ((public.es_owner(local_id) OR public.es_super_user())) WITH CHECK ((public.es_owner(local_id) OR public.es_super_user()));


--
-- Name: invitaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: locales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locales ENABLE ROW LEVEL SECURITY;

--
-- Name: locales locales_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY locales_delete ON public.locales FOR DELETE TO authenticated USING (public.es_super_user());


--
-- Name: locales locales_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY locales_insert ON public.locales FOR INSERT TO authenticated WITH CHECK ((creado_por = auth.uid()));


--
-- Name: locales locales_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY locales_select ON public.locales FOR SELECT TO authenticated USING ((public.es_miembro(id) OR public.es_super_user()));


--
-- Name: locales locales_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY locales_update ON public.locales FOR UPDATE TO authenticated USING ((public.es_owner(id) OR public.es_super_user())) WITH CHECK ((public.es_owner(id) OR public.es_super_user()));


--
-- Name: logs_auditoria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

--
-- Name: logs_auditoria_global; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.logs_auditoria_global ENABLE ROW LEVEL SECURITY;

--
-- Name: logs_auditoria_global logs_auditoria_global_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_auditoria_global_select ON public.logs_auditoria_global FOR SELECT TO authenticated USING (public.es_super_user());


--
-- Name: logs_auditoria logs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_insert ON public.logs_auditoria FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND public.es_miembro(local_id)));


--
-- Name: logs_auditoria logs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_select ON public.logs_auditoria FOR SELECT TO authenticated USING ((public.es_owner(local_id) OR (user_id = auth.uid()) OR public.es_super_user()));


--
-- Name: mapeo_locales_mp; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mapeo_locales_mp ENABLE ROW LEVEL SECURITY;

--
-- Name: mapeo_locales_mp mapeo_locales_mp_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mapeo_locales_mp_select ON public.mapeo_locales_mp FOR SELECT TO authenticated USING ((public.es_miembro(local_id) OR public.es_super_user()));


--
-- Name: mapeo_locales_mp mapeo_locales_mp_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mapeo_locales_mp_write ON public.mapeo_locales_mp TO authenticated USING (((public.rol_en_local(local_id) = 'owner'::text) OR public.es_super_user())) WITH CHECK (((public.rol_en_local(local_id) = 'owner'::text) OR public.es_super_user()));


--
-- Name: medios_pago; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medios_pago ENABLE ROW LEVEL SECURITY;

--
-- Name: medios_pago medios_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY medios_select ON public.medios_pago FOR SELECT TO authenticated USING ((public.es_miembro(local_id) OR public.es_super_user()));


--
-- Name: medios_pago medios_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY medios_write ON public.medios_pago TO authenticated USING ((public.es_owner(local_id) OR public.es_super_user())) WITH CHECK ((public.es_owner(local_id) OR public.es_super_user()));


--
-- Name: miembros_locales miembros_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY miembros_delete ON public.miembros_locales FOR DELETE TO authenticated USING ((public.es_owner(local_id) OR public.es_super_user()));


--
-- Name: miembros_locales miembros_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY miembros_insert ON public.miembros_locales FOR INSERT TO authenticated WITH CHECK ((public.es_super_user() OR public.es_owner(local_id) OR ((user_id = auth.uid()) AND (rol = 'owner'::text) AND (EXISTS ( SELECT 1
   FROM public.locales l
  WHERE ((l.id = miembros_locales.local_id) AND (l.creado_por = auth.uid())))))));


--
-- Name: miembros_locales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.miembros_locales ENABLE ROW LEVEL SECURITY;

--
-- Name: miembros_locales miembros_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY miembros_select ON public.miembros_locales FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.es_owner(local_id) OR public.es_super_user()));


--
-- Name: miembros_locales miembros_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY miembros_update ON public.miembros_locales FOR UPDATE TO authenticated USING ((public.es_owner(local_id) OR public.es_super_user())) WITH CHECK ((public.es_owner(local_id) OR public.es_super_user()));


--
-- Name: movimientos_mp_pendientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.movimientos_mp_pendientes ENABLE ROW LEVEL SECURITY;

--
-- Name: movimientos_mp_pendientes movimientos_mp_pendientes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY movimientos_mp_pendientes_select ON public.movimientos_mp_pendientes FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR ((local_id IS NOT NULL) AND public.es_miembro(local_id)) OR public.es_super_user()));


--
-- Name: movimientos_mp_pendientes movimientos_mp_pendientes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY movimientos_mp_pendientes_update ON public.movimientos_mp_pendientes FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) OR ((local_id IS NOT NULL) AND (public.rol_en_local(local_id) = ANY (ARRAY['owner'::text, 'cajero'::text]))) OR public.es_super_user())) WITH CHECK (((owner_id = auth.uid()) OR ((local_id IS NOT NULL) AND (public.rol_en_local(local_id) = ANY (ARRAY['owner'::text, 'cajero'::text]))) OR public.es_super_user()));


--
-- Name: mp_notificaciones_procesadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mp_notificaciones_procesadas ENABLE ROW LEVEL SECURITY;

--
-- Name: pagos_suscripcion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pagos_suscripcion ENABLE ROW LEVEL SECURITY;

--
-- Name: pagos_suscripcion pagos_suscripcion_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagos_suscripcion_select ON public.pagos_suscripcion FOR SELECT TO authenticated USING (public.es_super_user());


--
-- Name: perfiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

--
-- Name: perfiles perfiles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perfiles_insert ON public.perfiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: perfiles perfiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perfiles_select ON public.perfiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.es_super_user() OR (EXISTS ( SELECT 1
   FROM public.miembros_locales ml
  WHERE ((ml.user_id = perfiles.id) AND public.es_owner(ml.local_id))))));


--
-- Name: perfiles perfiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perfiles_update ON public.perfiles FOR UPDATE TO authenticated USING (((id = auth.uid()) OR public.es_super_user())) WITH CHECK (((id = auth.uid()) OR public.es_super_user()));


--
-- Name: planes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;

--
-- Name: planes planes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY planes_select ON public.planes FOR SELECT TO authenticated USING (true);


--
-- Name: planes planes_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY planes_write ON public.planes TO authenticated USING (public.es_super_user()) WITH CHECK (public.es_super_user());


--
-- Name: suscripciones sub_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sub_insert ON public.suscripciones FOR INSERT TO authenticated WITH CHECK ((public.es_owner(local_id) OR public.es_super_user()));


--
-- Name: suscripciones sub_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sub_select ON public.suscripciones FOR SELECT TO authenticated USING ((public.es_miembro(local_id) OR public.es_super_user()));


--
-- Name: suscripciones sub_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sub_update ON public.suscripciones FOR UPDATE TO authenticated USING (public.es_super_user()) WITH CHECK (public.es_super_user());


--
-- Name: suscripciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;

--
-- Name: suscripciones_cuenta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suscripciones_cuenta ENABLE ROW LEVEL SECURITY;

--
-- Name: suscripciones_cuenta suscripciones_cuenta_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suscripciones_cuenta_select ON public.suscripciones_cuenta FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR public.es_super_user() OR (EXISTS ( SELECT 1
   FROM public.locales l
  WHERE ((l.creado_por = suscripciones_cuenta.owner_id) AND public.es_miembro(l.id))))));


--
-- Name: suscripciones_cuenta suscripciones_cuenta_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suscripciones_cuenta_write ON public.suscripciones_cuenta TO authenticated USING (public.es_super_user()) WITH CHECK (public.es_super_user());


--
-- Name: transacciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;

--
-- Name: transacciones tx_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tx_insert ON public.transacciones FOR INSERT TO authenticated WITH CHECK ((public.es_super_user() OR (public.rol_en_local(local_id) = ANY (ARRAY['owner'::text, 'cajero'::text])) OR ((public.rol_en_local(local_id) = 'empleado'::text) AND (tipo = 'COBRO_RECIBIDO'::text) AND (es_reversa = false))));


--
-- Name: transacciones tx_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tx_select ON public.transacciones FOR SELECT TO authenticated USING ((public.es_miembro(local_id) OR public.es_super_user()));


--
-- PostgreSQL database dump complete
--

\unrestrict eHt6sgcCngM6zbu4RfaYdt6wlI5FSk5oXPYiOOzxH9lyXBmlspRkgfbonPnxCCD


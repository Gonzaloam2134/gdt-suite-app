-- ============================================================================
-- Hardening P0 — Ítem 15: unicidad real de invitaciones activas + ownership
-- ============================================================================
-- Contexto: auditoría del flujo de Equipo/Invitaciones (rama
-- equipo-invitaciones-test). lib/services/miembros.js hacía un INSERT directo
-- a invitaciones desde el cliente, sin constraint de unicidad en la base:
-- invitar dos veces al mismo email mientras la primera invitación seguía
-- vigente creaba una segunda fila pendiente (dos links activos para la misma
-- persona/local). Tampoco se verificaba si la persona ya era miembro activo
-- del local antes de invitarla de nuevo.
--
-- Fix: índice único parcial que impide más de una invitación 'pendiente' por
-- (local_id, email_invitado), y una función crear_invitacion() que:
--   - exige sesión y que el llamador sea OWNER del local (is_local_owner),
--     igual que ya exige la RLS para el insert directo que esta función
--     reemplaza — así no se abre una puerta nueva al ser SECURITY DEFINER;
--   - usa auth.uid() como única fuente de verdad para invitado_por, nunca
--     un valor mandado por el cliente;
--   - rechaza si la persona ya es miembro activo del local;
--   - si ya existe una invitación pendiente vigente, la reutiliza tal cual
--     (mismo token, no se toca nada) — ON CONFLICT DO UPDATE con los mismos
--     valores actuales es un no-op funcional;
--   - si la invitación pendiente existente ya venció, la renueva (token y
--     vencimiento nuevos) en la misma fila en vez de crear otra.
-- Todo en una sola operación atómica: no hay ventana entre "ver si existe" y
-- "crear" donde dos invitaciones simultáneas puedan colarse — lo resuelve el
-- índice único + ON CONFLICT, no un SELECT previo en el cliente.
-- ============================================================================

create unique index if not exists invitaciones_pendiente_unica
  on invitaciones (local_id, lower(email_invitado))
  where estado = 'pendiente';

create or replace function public.crear_invitacion(
  p_local_id uuid, p_email text, p_nombre text, p_rol text
) returns invitaciones
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
end $function$;

revoke execute on function public.crear_invitacion(uuid, text, text, text) from anon;

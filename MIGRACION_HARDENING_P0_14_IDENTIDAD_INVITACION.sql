-- ============================================================================
-- Hardening P0 — Ítem 14: identidad del aceptante de una invitación
-- ============================================================================
-- Contexto: auditoría del flujo de Equipo/Invitaciones (rama
-- equipo-invitaciones-test). aceptar_invitacion(p_token) nunca comparaba el
-- email de la cuenta autenticada (auth.uid()) contra invitaciones.email_invitado.
-- Resultado: cualquiera que consiguiera el link (token en la URL, reenviado
-- por WhatsApp, visto en un chat compartido) podía aceptar la invitación
-- logueado con CUALQUIER cuenta, no solo con la del destinatario real —
-- secuestro de invitación, quedándose con la membresía en el local de otro.
--
-- Fix: antes de crear/reactivar la membresía, se exige que el email de
-- auth.users para auth.uid() coincida (case-insensitive, trim) con
-- invitaciones.email_invitado. Se consulta auth.users en vez de perfiles
-- para no depender de que el perfil esté sincronizado con un cambio de
-- email hecho directamente en Auth.
--
-- El resto de la función queda idéntico: la lógica de rol existente
-- (coalesce con el rol que la persona ya tenía en otro local activo), el
-- ON CONFLICT (local_id, user_id) que hace la reincorporación idempotente,
-- y el insert transaccional en logs_auditoria, ya estaban correctos.
-- ============================================================================

create or replace function public.aceptar_invitacion(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
end $function$;

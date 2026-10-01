-- ============================================================================
-- Hardening P0 — Ítem 1: aislamiento multi-tenant real
-- ============================================================================
-- Contexto: auditoría de RLS/policies/grants/SECURITY DEFINER sobre el schema
-- real (ver scripts/audit-rls.mjs). La gran mayoría de las tablas aíslan
-- correctamente (locales, transacciones, cierres_caja, medios_pago,
-- miembros_locales, perfiles — probado con dos cuentas reales). Se encontraron
-- dos grietas puntuales, corregidas acá:
--
-- 1) logs_auditoria.logs_insert solo exigía `user_id = auth.uid()`, sin
--    exigir que esa persona sea miembro de `local_id`. Cualquier usuario
--    autenticado podía insertar una entrada de auditoría en el local de
--    OTRA cuenta, atribuida a sí mismo — ensucia el historial de auditoría
--    de un tenant ajeno (comprobado en vivo contra un local real).
--
-- 2) Tres funciones SECURITY DEFINER (que bypassean RLS por diseño) tenían
--    EXECUTE otorgado a `anon` (clientes sin sesión):
--      - registrar_log: código muerto (no se llama desde el frontend; el
--        registro real pasa por lib/services/auditoria.js vía INSERT normal
--        + RLS). No valida que p_user_id sea auth.uid() ni que el caller
--        sea miembro de p_local_id — permite forjar auditoría de cualquier
--        local/usuario, incluso sin estar logueado.
--      - is_local_owner: código muerto (no se llama desde el frontend).
--        Deja a cualquiera, sin sesión, consultar si un (local_id,user_id)
--        es dueño — exposición menor, pero sin motivo para estar abierta.
--      - rol_existente_de: SÍ se usa (lib/services/miembros.js, flujo de
--        invitar) pero solo necesita que el llamador esté logueado — dejarla
--        abierta a `anon` permite usarla como oráculo para adivinar, sin
--        cuenta, si un email está registrado y con qué rol.
--    aceptar_invitacion ya se auto-protege (devuelve error si auth.uid() es
--    null), pero no hay ningún caso de uso legítimo para invocarla sin
--    sesión — se le saca el permiso a `anon` igual, en profundidad.
--    ver_invitacion SÍ necesita ser pública: pages/invitacion.jsx la llama
--    antes de que la persona inicie sesión (así funciona el link de
--    invitación). No se toca.
-- ============================================================================

-- 1) logs_auditoria: exigir membresía real en el local, no solo autoría.
drop policy if exists logs_insert on logs_auditoria;
create policy logs_insert on logs_auditoria
  for insert to authenticated
  with check (user_id = auth.uid() and es_miembro(local_id));

-- 2) Funciones SECURITY DEFINER: sacar el acceso que no corresponde.
-- registrar_log e is_local_owner conservaban además el grant implícito a
-- PUBLIC que Postgres otorga por defecto al crear una función — sin
-- revocarlo ahí, `anon` seguía pudiendo ejecutarlas aunque se le revocara
-- el permiso explícito (hereda de PUBLIC). Primera corrida de
-- scripts/audit-rls.mjs post-fix lo dejó en evidencia: las dos seguían
-- siendo invocables sin sesión.
revoke execute on function public.registrar_log(uuid, uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.is_local_owner(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.rol_existente_de(text) from anon;
revoke execute on function public.aceptar_invitacion(text) from anon;

-- ============================================================================
-- Hardening P1 — Ítem 7: idempotencia real de los webhooks de Mercado Pago
-- ============================================================================
-- mp_notificaciones_procesadas solo tenía `id` + `procesada_en` (grabado AL
-- RECIBIR el webhook, antes de procesarlo — el nombre de la columna ya era
-- engañoso). Si el procesamiento de negocio fallaba después de ese insert
-- (ej. Mercado Pago no responde, un insert falla), la notificación quedaba
-- marcada como "procesada" para siempre: un reintento futuro de MP para el
-- MISMO evento se descartaba sin volver a intentar — se perdía la operación
-- de negocio (activar un plan, confirmar un cobro) sin ningún aviso.
--
-- Se agrega una distinción real entre "recibida" y "completada con éxito",
-- con dos funciones atómicas (mismo patrón que los índices únicos de
-- P0: la base es la autoridad final, no una revalidación de la app):
--
-- - registrar_intento_webhook_mp(id): UPSERT atómico. Si la fila no existía,
--   la crea. Si ya existía pero NUNCA se completó con éxito, incrementa el
--   contador de intentos y dice "procesala". Si ya se había completado con
--   éxito antes, dice "no hace falta" (duplicado real).
-- - marcar_webhook_mp_resultado(id, exito, error): al terminar de procesar,
--   marca completada_en (si tuvo éxito) o guarda el último error (si no).
--
-- Las 37 notificaciones que ya existen son de ANTES de este cambio — no se
-- sabe si terminaron de procesarse bien. Se marcan como completadas para no
-- generar un reprocesamiento masivo sorpresivo de eventos viejos al
-- desplegar esto (la idempotencia hacia ADELANTE es lo que importa).
-- ============================================================================

alter table mp_notificaciones_procesadas rename column procesada_en to recibida_en;
alter table mp_notificaciones_procesadas
  add column if not exists completada_en timestamptz,
  add column if not exists intentos integer not null default 1,
  add column if not exists ultimo_error text;

update mp_notificaciones_procesadas set completada_en = recibida_en where completada_en is null;

create or replace function public.registrar_intento_webhook_mp(p_id text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
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

create or replace function public.marcar_webhook_mp_resultado(p_id text, p_exito boolean, p_error text default null)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update mp_notificaciones_procesadas
  set completada_en = case when p_exito then now() else completada_en end,
      ultimo_error = p_error
  where id = p_id;
$$;

-- Server-only: estas funciones las llama el webhook con supabaseAdmin
-- (service_role), nunca el navegador.
revoke execute on function public.registrar_intento_webhook_mp(text) from public, anon, authenticated;
revoke execute on function public.marcar_webhook_mp_resultado(text, boolean, text) from public, anon, authenticated;

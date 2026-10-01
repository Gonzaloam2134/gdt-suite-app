-- ============================================================================
-- Hardening P1 — Ítem 5: no confiar en `medio` enviado por el navegador
-- ============================================================================
-- registrarCobro()/registrarGasto() (lib/services/transacciones.js) armaban
-- comision_monto, monto_iva, monto_neto y fecha_acreditacion_estimada en el
-- CLIENTE, a partir del objeto `medio` que llega por props — nada impedía
-- que una request directa a la API de Supabase (sin pasar por la UI)
-- insertara esos valores con cualquier número, o un medio_pago_id de OTRO
-- local.
--
-- Este trigger recalcula esos 4 campos en la base, a partir de `monto` y
-- del medio de pago REAL (mismo local), ignorando lo que haya llegado desde
-- el navegador para esos campos puntuales.
--
-- OJO reversas: `es_reversa = true` sale del trigger sin tocar nada — una
-- reversa clona (negados) los valores YA GUARDADOS en la transacción
-- original, no recalcula con la comisión actual del medio. Si no fuera así,
-- se rompería la regla de dominio "cambiar la comisión de un medio de pago
-- no reescribe el pasado" (CLAUDE.md).
--
-- OJO gastos: la comisión de un medio de pago es lo que cobra el
-- procesador por ACEPTAR un cobro — no aplica a un gasto. comision_monto
-- se fuerza a 0 para cualquier `tipo` distinto de COBRO_RECIBIDO (que es
-- el comportamiento actual de registrarGasto(), ahora garantizado también
-- si alguien intenta forzarlo por fuera de la UI).
-- ============================================================================

create or replace function public.calcular_financieros_transaccion()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
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

drop trigger if exists trg_calcular_financieros_transaccion on transacciones;
create trigger trg_calcular_financieros_transaccion
  before insert on transacciones
  for each row execute function calcular_financieros_transaccion();

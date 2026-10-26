-- ============================================================================
-- GDT Suite — Cuenta corriente: hardening post-revisión
-- ============================================================================
-- Corre DESPUÉS de MIGRACION_CUENTA_CORRIENTE.sql (en dev y en prod, igual que
-- esa).
--
-- Hallazgo que tapa (revisión adversarial antes de mergear a main):
-- si alguien anula un pago de cuenta corriente desde la pantalla NORMAL de
-- Caja (no desde el modal de "Anular" de /cuenta-corriente), la plata sale
-- del arqueo pero el saldo del cliente en movimientos_cc queda como si
-- siguiera pagado — nada conectaba los dos lados. Esto agrega esa conexión
-- a nivel de base, para que valga sin importar desde qué pantalla se anule.
--
-- También reemplaza el insert en dos pasos de `registrarPagoCc` (cobro +
-- movimiento 'pago' por separado, sin red de seguridad si el segundo falla
-- después del primero) por una función que hace ambos inserts en una sola
-- transacción atómica.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Al anular un cobro en `transacciones` (insertar su reversa), si ese
--    cobro tiene un 'pago' de cuenta corriente vinculado y todavía vigente,
--    generar automáticamente la reversa correspondiente en movimientos_cc.
--    security definer: corre sin importar qué rol hizo la anulación en
--    `transacciones` (misma idea que marcar_movimiento_cc_revertido).
-- ---------------------------------------------------------------------------
create or replace function public.sincronizar_reversa_cc()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_movimiento movimientos_cc;
begin
  if new.es_reversa and new.reversa_de is not null then
    select * into v_movimiento
      from movimientos_cc
      where transaccion_id = new.reversa_de
        and tipo = 'pago'
        and not es_reversa
        and not revertida
      limit 1;

    if v_movimiento.id is not null then
      insert into movimientos_cc (
        cliente_id, local_id, tipo, monto, descripcion,
        transaccion_id, es_reversa, reversa_de, creado_por
      ) values (
        v_movimiento.cliente_id, v_movimiento.local_id, v_movimiento.tipo,
        -v_movimiento.monto,
        '[REVERSA automática] ' || coalesce(v_movimiento.descripcion, 'Pago cuenta corriente'),
        new.id, true, v_movimiento.id, v_movimiento.creado_por
      )
      on conflict (reversa_de) where reversa_de is not null do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sincronizar_reversa_cc on transacciones;
create trigger trg_sincronizar_reversa_cc
  after insert on transacciones
  for each row
  execute function public.sincronizar_reversa_cc();

-- ---------------------------------------------------------------------------
-- 2) registrarPagoCc en un solo paso atómico: el cobro en `transacciones`
--    y el movimiento 'pago' que lo vincula se crean en la misma transacción
--    de base — si algo falla, no queda un cobro "huérfano" sin cliente.
--    security invoker: respeta las RLS de transacciones y movimientos_cc
--    como si el llamador hiciera los dos inserts él mismo.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_pago_cc(
  p_cliente_id uuid,
  p_local_id uuid,
  p_medio_pago_id uuid,
  p_monto numeric,
  p_descripcion text,
  p_creado_por uuid,
  p_alicuota numeric default 21
)
returns movimientos_cc
language plpgsql
security invoker
as $$
declare
  v_transaccion transacciones;
  v_movimiento movimientos_cc;
begin
  insert into transacciones (
    local_id, tipo, medio_pago_id, monto, alicuota_iva, descripcion, creado_en, es_reversa
  ) values (
    p_local_id, 'COBRO_RECIBIDO', p_medio_pago_id, p_monto, p_alicuota,
    coalesce(p_descripcion, 'Pago cuenta corriente'), now(), false
  ) returning * into v_transaccion;

  insert into movimientos_cc (
    cliente_id, local_id, tipo, monto, descripcion, transaccion_id, creado_por
  ) values (
    p_cliente_id, p_local_id, 'pago', p_monto,
    coalesce(p_descripcion, 'Pago cuenta corriente'), v_transaccion.id, p_creado_por
  ) returning * into v_movimiento;

  return v_movimiento;
end;
$$;

grant execute on function public.registrar_pago_cc(uuid, uuid, uuid, numeric, text, uuid, numeric) to authenticated;

-- Avisar a PostgREST que hay funciones/firmas nuevas (ver el issue de schema
-- cache que ya pasamos con clientes_cc/movimientos_cc).
notify pgrst, 'reload schema';

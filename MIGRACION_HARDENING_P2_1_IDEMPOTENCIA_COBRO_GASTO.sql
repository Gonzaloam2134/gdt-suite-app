-- ============================================================================
-- Hardening P2 — Ítem 1: idempotencia en cobros y gastos, garantizado en DB
-- ============================================================================
-- registrarCobro()/registrarGasto() (lib/services/transacciones.js) son un
-- INSERT sin ninguna protección contra duplicados — a diferencia de
-- abrirCaja() (índice único cierres_caja_una_abierta_por_local) y de
-- registrarReversa() (índice único tx_una_reversa_por_original), que ya
-- tienen esta garantía desde hardening anterior.
--
-- Escenario real: alguien toca "Cobrar", el servidor guarda el movimiento,
-- pero la respuesta se pierde por un corte de red. La persona ve un error
-- en pantalla, no sabe si se guardó, y vuelve a tocar "Cobrar" — sin esto,
-- el resultado es un cobro cargado DOS VECES (la plata de la caja no
-- cuadraría contra el cuaderno, justo lo que CLAUDE.md marca como el bug
-- más caro que puede haber en esta app).
--
-- Mismo patrón que tx_una_reversa_por_original: un índice único parcial,
-- esta vez sobre una columna nueva que el cliente llena con un UUID
-- generado una sola vez por intento de cobro/gasto (MovimientoModal lo
-- genera al abrir el modal y lo reusa en cada reintento — nunca lo
-- regenera solo). Las filas que no mandan idempotency_key (reversas,
-- datos viejos, cualquier insert fuera de este flujo) no participan del
-- constraint.
-- ============================================================================

alter table transacciones add column if not exists idempotency_key uuid null;

create unique index if not exists tx_idempotency_key_unica
  on transacciones (idempotency_key)
  where idempotency_key is not null;

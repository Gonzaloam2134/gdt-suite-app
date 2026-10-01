-- ============================================================================
-- Hardening P0 — Ítem 4: validaciones financieras en DB
-- ============================================================================
-- Antes de escribir esto se inspeccionaron tipos, constraints y DATOS REALES
-- de transacciones/cierres_caja/medios_pago/pagos_suscripcion (ver
-- scripts/check-item4 en el historial de esta sesión). Puntos clave que
-- determinaron el diseño:
--
-- - Las reversas SÍ usan monto/comision_monto/monto_iva/monto_neto negativos
--   a propósito (lib/services/transacciones.js: registrarReversa niega los
--   4 campos del original). Por eso ningún CHECK de signo puede ser un simple
--   ">= 0" — tiene que condicionarse a `es_reversa`.
-- - En los datos reales, el signo de comision_monto/monto_iva/monto_neto
--   SIEMPRE coincide con el de monto (0 excepciones) — es consistente con
--   que son proporciones del mismo monto, nunca valores independientes.
-- - es_reversa y reversa_de ya son 100% consistentes en los datos reales
--   (siempre van juntos), pero no había ningún constraint que lo garantizara
--   hacia adelante.
-- - Los únicos `tipo` que de hecho se insertan en transacciones son
--   COBRO_RECIBIDO y GASTO_REGISTRADO (CAJA_ABIERTA/CAJA_CERRADA están
--   permitidos por transacciones_tipo_check pero no los usa ningún código
--   actual — no se tocan, no es parte de este ítem).
-- - cierres_caja: monto_inicial_efectivo, efectivo_fisico, total_cobrado y
--   total_gastado son siempre >= 0 en los datos reales. diferencia_efectivo
--   SÍ es legítimamente negativa (faltante de caja) — no se constriñe su
--   signo. fecha_cierre siempre es >= fecha_apertura (0 excepciones).
-- - medios_pago.comision_porcentaje está en [0, 3.5] hoy; plazo_acreditacion_dias
--   en [0, 30]. pagos_suscripcion.monto siempre > 0.
--
-- Todos los constraints se verificaron contra los datos reales antes de
-- escribir este archivo: ninguno tiene filas que lo violen hoy.
-- ============================================================================

-- transacciones --------------------------------------------------------------

-- El signo de `monto` tiene que coincidir con `es_reversa`: un cobro o gasto
-- real es siempre positivo, una reversa es siempre negativa. monto = 0 queda
-- excluido como efecto colateral (ninguno de los dos lados del OR lo admite).
alter table transacciones
  add constraint transacciones_monto_signo_reversa_check
  check (
    (es_reversa = true  and monto < 0) or
    (es_reversa = false and monto > 0)
  );

-- comisión/IVA/neto son proporciones de `monto`: tienen que moverse en el
-- mismo sentido (o ser cero), nunca al revés — eso sería un cálculo corrupto,
-- no una reversa legítima.
alter table transacciones
  add constraint transacciones_componentes_mismo_signo_check
  check (
    (monto > 0 and comision_monto >= 0 and monto_iva >= 0 and monto_neto >= 0) or
    (monto < 0 and comision_monto <= 0 and monto_iva <= 0 and monto_neto <= 0)
  );

-- `es_reversa` y `reversa_de` tienen que ir siempre juntos.
alter table transacciones
  add constraint transacciones_reversa_consistencia_check
  check (es_reversa = (reversa_de is not null));

-- cierres_caja -----------------------------------------------------------

alter table cierres_caja
  add constraint cierres_caja_monto_inicial_no_negativo_check
  check (monto_inicial_efectivo is null or monto_inicial_efectivo >= 0);

alter table cierres_caja
  add constraint cierres_caja_efectivo_fisico_no_negativo_check
  check (efectivo_fisico is null or efectivo_fisico >= 0);

alter table cierres_caja
  add constraint cierres_caja_totales_no_negativos_check
  check (
    (total_cobrado is null or total_cobrado >= 0) and
    (total_gastado is null or total_gastado >= 0)
  );

alter table cierres_caja
  add constraint cierres_caja_cantidad_tx_no_negativa_check
  check (cantidad_transacciones is null or cantidad_transacciones >= 0);

-- No se puede cerrar una caja antes de haberla abierto.
alter table cierres_caja
  add constraint cierres_caja_fechas_check
  check (fecha_cierre is null or fecha_cierre >= fecha_apertura);

-- medios_pago --------------------------------------------------------------

alter table medios_pago
  add constraint medios_pago_comision_rango_check
  check (comision_porcentaje is null or (comision_porcentaje >= 0 and comision_porcentaje <= 100));

alter table medios_pago
  add constraint medios_pago_plazo_no_negativo_check
  check (plazo_acreditacion_dias is null or plazo_acreditacion_dias >= 0);

-- pagos_suscripcion ----------------------------------------------------------

alter table pagos_suscripcion
  add constraint pagos_suscripcion_monto_positivo_check
  check (monto > 0);

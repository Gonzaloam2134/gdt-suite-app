-- ============================================================================
-- Hardening P0/P1 — Ítem 3: una sola reversa por transacción, garantizado en DB
-- ============================================================================
-- components/ReversaModal.jsx ya revalida (`getTransaccion`) justo antes de
-- insertar la reversa, pero el propio comentario en el código lo dice: eso
-- reduce la ventana de carrera, no la cierra ("para eso hace falta un
-- constraint en la base"). Confirmado en vivo con
-- scripts/test-reversa-race.mjs: dos reversas "simultáneas" (Promise.all)
-- de la misma transacción se insertaban las DOS — duplicaría el ajuste
-- financiero (ej. -1000 dos veces sobre un cobro de +1000).
--
-- No hay ningún constraint sobre `reversa_de` hoy (solo índices no-únicos
-- de lectura: idx_transacciones_reversa_de, tx_reversa_de_idx). Se agrega
-- un índice único parcial: cada transacción original puede tener como
-- máximo UNA fila que la reverse. No aplica a filas donde reversa_de es
-- null (todas las transacciones normales, que no reversan nada).
-- ============================================================================

create unique index if not exists tx_una_reversa_por_original
  on transacciones (reversa_de)
  where reversa_de is not null;

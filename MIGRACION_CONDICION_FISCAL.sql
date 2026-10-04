-- ============================================================================
-- MIGRACIÓN: condición fiscal de los locales deja de ser texto libre
--
-- "Consumidor Final" no es un régimen tributario del comercio (es el tipo de
-- cliente de una venta). Pasa a "No inscripto", y locales.condicion_fiscal
-- queda restringida a los tres valores que la app realmente soporta.
--
-- ANTES DE CORRER, revisar que no haya otros valores (por ejemplo 'Exento'):
--   SELECT condicion_fiscal, count(*) FROM locales GROUP BY 1 ORDER BY 2 DESC;
-- Si hay valores fuera de la lista, este script ABORTA sin cambiar nada
-- (todo corre en una transacción).
-- ============================================================================

BEGIN;

UPDATE locales
   SET condicion_fiscal = 'No inscripto'
 WHERE condicion_fiscal = 'Consumidor Final';

DO $$
DECLARE
  invalidos text;
BEGIN
  SELECT string_agg(DISTINCT condicion_fiscal, ', ')
    INTO invalidos
    FROM locales
   WHERE condicion_fiscal IS NOT NULL
     AND condicion_fiscal NOT IN ('No inscripto', 'Monotributo', 'Responsable Inscripto');

  IF invalidos IS NOT NULL THEN
    RAISE EXCEPTION 'locales.condicion_fiscal tiene valores fuera de la lista permitida: %. Corregirlos antes de aplicar el CHECK.', invalidos;
  END IF;
END $$;

ALTER TABLE locales
  ADD CONSTRAINT locales_condicion_fiscal_check
  CHECK (condicion_fiscal IN ('No inscripto', 'Monotributo', 'Responsable Inscripto'));

COMMIT;

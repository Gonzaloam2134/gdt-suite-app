-- ============================================================================
-- GDT SUITE — Aceptación de Términos y Condiciones
-- Se versiona por fecha (terminos_version = VERSION_TERMINOS_ACTUAL en
-- lib/constants/legal.js), no por un booleano: el día que el documento
-- cambie, alcanza con actualizar esa constante para que se le vuelva a pedir
-- la aceptación a todo el mundo, incluidos los que ya habían aceptado la
-- versión anterior. No se guarda historial completo de cada versión
-- aceptada — se sobreescribe con la fecha/versión nueva al aceptar.
-- ============================================================================

alter table perfiles
  add column if not exists terminos_aceptados_en timestamptz,
  add column if not exists terminos_version text;

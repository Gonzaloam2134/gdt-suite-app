-- Hace editable el texto vigente de los Términos y Condiciones desde el panel
-- de super admin, sin depender de un deploy de código para cambiarlo.
--
-- Mientras terminos_texto sea NULL (migración recién corrida, o nunca se
-- editó desde el panel), la app sigue mostrando el texto hardcodeado de
-- lib/constants/legal.js (TERMINOS_TEXTO) — mismo criterio de "fallback a
-- default" que ya usa configuracion_global para sus otras columnas.
--
-- Correr en Supabase (dev y prod) — SQL Editor.

alter table configuracion_global
  add column if not exists terminos_texto text,
  add column if not exists terminos_version text;

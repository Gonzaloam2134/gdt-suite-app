-- Cambia el período de prueba gratuita de 30 a 7 días.
-- Correr en Supabase (dev y prod) — SQL Editor.
--
-- Único cambio respecto a la versión actual (confirmada con
-- pg_get_functiondef): el intervalo de 30 days a 7 days. El resto de la
-- función queda idéntico: mismo trigger, misma firma, mismo
-- on conflict (owner_id) do nothing (un local nuevo en una cuenta que ya
-- tiene suscripción no reinicia ni toca el período).

CREATE OR REPLACE FUNCTION public.crear_prueba_si_no_existe()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into suscripciones_cuenta (owner_id, plan, estado, fecha_vencimiento)
  values (new.creado_por, 'trial', 'active', (now() + interval '7 days')::date)
  on conflict (owner_id) do nothing;
  return new;
end $function$

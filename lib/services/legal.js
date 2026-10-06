/**
 * No usa `supabase.from()` directo (a diferencia del resto de lib/services/*):
 * los Términos vigentes se leen vía API route con Service Role
 * (pages/api/terminos-vigentes.js) porque hace falta poder leerlos sin
 * sesión — antes de registrarse, o en cualquier pantalla protegida antes de
 * saber el rol. Guardar un texto nuevo sigue siendo responsabilidad de
 * super admin vía lib/services/superadmin.js (guardarConfigGlobal), bajo RLS
 * normal.
 */
export const getTerminosVigentes = async () => {
  const res = await fetch('/api/terminos-vigentes')
  if (!res.ok) throw new Error('No se pudieron obtener los Términos y Condiciones vigentes')
  return res.json() // { texto, version }
}

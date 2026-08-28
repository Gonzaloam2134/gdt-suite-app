/** Convierte { data, error } de Supabase en data-o-throw para no repetir `if (error) throw error` */
export const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message || 'Error de base de datos')
  return data
}

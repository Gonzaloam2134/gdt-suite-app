/**
 * Convierte { data, error } de Supabase en data-o-throw para no repetir
 * `if (error) throw error`. Conserva `code` (ej. '23505' = unique_violation)
 * en el Error relanzado — sin esto, el código que necesita distinguir ESE
 * constraint puntual (ej. "una sola caja abierta por local") solo podía
 * matchear contra el texto del mensaje, frágil ante cambios de Postgres.
 */
export const unwrap = ({ data, error }) => {
  if (error) {
    const e = new Error(error.message || 'Error de base de datos')
    e.code = error.code
    throw e
  }
  return data
}

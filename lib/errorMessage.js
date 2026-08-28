/**
 * Traduce errores técnicos de Postgres/Supabase a un mensaje que un cajero
 * pueda entender. Si no reconoce el patrón, devuelve el mensaje original
 * (mejor mostrar algo específico que un genérico que tape el problema real).
 */
export const mensajeError = (err) => {
  const msg = err?.message || ''
  if (msg.includes('duplicate key') || msg.includes('unique constraint') || msg.includes('ya existe')) {
    return 'Ya existe un registro con esos datos.'
  }
  if (msg.includes('violates foreign key') || msg.includes('is still referenced')) {
    return 'No se puede completar: hay otros datos que dependen de esto.'
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network')) {
    return 'No hay conexión a internet. Revisá tu señal e intentá de nuevo.'
  }
  if (msg.includes('JWT') || msg.includes('session')) {
    return 'Tu sesión expiró. Volvé a iniciar sesión.'
  }
  return msg || 'Ocurrió un error inesperado.'
}

const LOCALE = 'es-AR'

const esNumero = (n) => n !== null && n !== undefined && !Number.isNaN(Number(n))

export const formatCurrency = (amount) => {
  if (!esNumero(amount)) return '$0,00'
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(amount))
}

export const formatNumber = (amount, decimales = 2) => {
  if (!esNumero(amount)) return '0,00'
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimales, maximumFractionDigits: decimales,
  }).format(Number(amount))
}

export const formatPorcentaje = (valor) => `${formatNumber(valor, 2)}%`

/** 14:35 */
export const formatHora = (fecha) => {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}

/** 25/08/2026 */
export const formatFecha = (fecha) => {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** 25/08/2026 14:35 */
export const formatFechaHora = (fecha) => {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleString(LOCALE, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** martes 25 de agosto */
export const formatFechaLarga = (fecha) => {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })
}

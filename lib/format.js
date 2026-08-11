export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0,00'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

export const formatNumber = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0,00'
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

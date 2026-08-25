/**
 * Todas las fechas de la app se calculan en hora LOCAL del navegador
 * (Argentina, UTC-3). Nunca usar toISOString().split('T')[0] para obtener
 * "el día de hoy": devuelve la fecha en UTC y después de las 21:00 ya es mañana.
 */

const pad = (n) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DD' en hora local */
export const aFechaISO = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 'YYYY-MM-DD' → Date a las 12:00 local (evita saltos de día por DST/UTC) */
export const desdeFechaISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

export const hoyISO = () => aFechaISO(new Date())

export const esHoy = (iso) => iso === hoyISO()

/** Rango [inicio, fin] de un día local, como ISO completos para Supabase */
export const rangoDia = (iso = hoyISO()) => {
  const base = desdeFechaISO(iso)
  const inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0)
  const fin = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999)
  return { inicio: inicio.toISOString(), fin: fin.toISOString() }
}

/** Rango entre dos 'YYYY-MM-DD' locales (inclusive) */
export const rangoEntre = (desdeISO, hastaISO) => ({
  inicio: rangoDia(desdeISO).inicio,
  fin: rangoDia(hastaISO).fin,
})

export const sumarDias = (fecha, dias) => {
  const d = new Date(fecha)
  d.setDate(d.getDate() + dias)
  return d
}

/**
 * Períodos rápidos. Devuelven { desde, hasta } como 'YYYY-MM-DD'.
 * Usado por admin (hoy/semana/mes) y reportes (este-mes/mes-anterior/ultimos-30/trimestre).
 */
export const periodoRapido = (tipo, ref = new Date()) => {
  const hoy = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  let desde = new Date(hoy)
  let hasta = new Date(hoy)

  switch (tipo) {
    case 'hoy':
      break
    case 'semana': // últimos 7 días incluyendo hoy
      desde.setDate(hoy.getDate() - 6)
      break
    case 'ultimos-30':
      desde.setDate(hoy.getDate() - 30)
      break
    case 'mes':
    case 'este-mes':
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
      break
    case 'mes-anterior':
      desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      break
    case 'trimestre': // este mes y los dos anteriores
      desde = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)
      hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
      break
    default:
      break
  }
  return { desde: aFechaISO(desde), hasta: aFechaISO(hasta) }
}

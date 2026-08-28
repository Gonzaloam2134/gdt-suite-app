/**
 * Lógica de negocio pura sobre cierres_caja (aperturas/cierres de caja).
 * Sin React, sin Supabase. Testeable con datos en memoria.
 */
import { aFechaISO, hoyISO } from '../dates'

/**
 * ¿La caja se abrió el día de referencia ("hoy" real, salvo que se pase otro
 * explícito)? Distingue la caja operativa del día de una "huérfana" (abierta
 * un día anterior y nunca cerrada): si esto da `false` para la única caja
 * abierta del local, es huérfana.
 *
 * Recibe `refISO` en vez de calcular "hoy" adentro para poder testear con
 * fechas fijas — mismo patrón que `calcularTotalesDia(transacciones, diaISO)`.
 *
 * @param {{fecha_apertura: string}} caja  fila de cierres_caja, o null/undefined
 * @param {string} [refISO]  'YYYY-MM-DD' del día de referencia (default: hoy real)
 */
export const esCajaDeHoy = (caja, refISO = hoyISO()) =>
  !!caja && aFechaISO(new Date(caja.fecha_apertura)) === refISO

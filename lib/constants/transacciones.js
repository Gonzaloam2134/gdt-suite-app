/** transacciones.tipo (check constraint) */
export const TIPO_TX = Object.freeze({
  COBRO: 'COBRO_RECIBIDO',
  GASTO: 'GASTO_REGISTRADO',
})

/** transacciones.alicuota_iva (check transacciones_alicuota_check) */
export const ALICUOTAS_IVA = [
  { value: 21,   label: '21% (General)' },
  { value: 10.5, label: '10,5% (Reducida)' },
  { value: 27,   label: '27% (Servicios públicos)' },
  { value: 0,    label: '0% (Exento / Monotributo)' },
]

/** transacciones.tipo_comprobante (check transacciones_tipo_comprobante_check) */
export const TIPOS_COMPROBANTE = [
  { value: 'A',               label: 'Factura A' },
  { value: 'B',               label: 'Factura B' },
  { value: 'C',               label: 'Factura C' },
  { value: 'M',               label: 'Factura M' },
  { value: 'TICKET',          label: 'Ticket' },
  { value: 'SIN_COMPROBANTE', label: 'Sin comprobante' },
]

/**
 * Condiciones fiscales válidas de un local (locales.condicion_fiscal, check en la base).
 * "Consumidor Final" NO es una condición del comercio: es el tipo de cliente de una venta.
 * "Exento" no está soportado a propósito: si se agrega, va a la vez en este mapa, en el
 * select del OnboardingWizard y en el CHECK de la base.
 *
 * Qué comprobante emite un local según su condición fiscal.
 * Se usa para el default del CobroModal y para decidir si mostrar IVA en reportes.
 */
export const COMPROBANTE_POR_CONDICION = {
  'Responsable Inscripto': 'B',   // A si el cliente es RI; B por defecto
  'Monotributo': 'C',
  'No inscripto': 'SIN_COMPROBANTE',
}

export const discriminaIva = (condicionFiscal) => condicionFiscal === 'Responsable Inscripto'

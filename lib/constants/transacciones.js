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
 * Qué comprobante emite un local según su condición fiscal.
 * Se usa para el default del CobroModal y para decidir si mostrar IVA en reportes.
 */
export const COMPROBANTE_POR_CONDICION = {
  'Responsable Inscripto': 'B',   // A si el cliente es RI; B por defecto
  'Monotributo': 'C',
  'Exento': 'C',
  'Consumidor Final': 'SIN_COMPROBANTE',
}

export const discriminaIva = (condicionFiscal) => condicionFiscal === 'Responsable Inscripto'

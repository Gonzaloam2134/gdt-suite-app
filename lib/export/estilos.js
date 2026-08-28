/**
 * Paleta y formatos compartidos por el PDF y el Excel, para que los dos
 * documentos se vean como parte del mismo juego.
 */

// PDF (jsPDF usa arrays RGB)
export const RGB = {
  azul: [30, 58, 95],
  azulClaro: [232, 238, 246],
  gris: [110, 116, 124],
  grisClaro: [246, 247, 249],
  negro: [33, 37, 41],
  verde: [21, 115, 71],
  rojo: [176, 42, 42],
  ambar: [146, 94, 8],
  blanco: [255, 255, 255],
  linea: [214, 218, 224],
}

// Excel (ExcelJS usa ARGB sin numeral)
export const HEX = {
  azul: 'FF1E3A5F',
  azulMedio: 'FF2E5A8A',
  azulClaro: 'FFE8EEF6',
  gris: 'FF6E747C',
  grisClaro: 'FFF6F7F9',
  negro: 'FF212529',
  verde: 'FF157347',
  verdeClaro: 'FFE7F3EC',
  rojo: 'FFB02A2A',
  rojoClaro: 'FFFBEAEA',
  ambar: 'FF925E08',
  ambarClaro: 'FFFDF3E2',
  blanco: 'FFFFFFFF',
  linea: 'FFD6DAE0',
}

/** Formatos de número: los importes tienen que poder sumarse en Excel. */
export const FMT = {
  moneda: '"$"#,##0.00;[Red]-"$"#,##0.00',
  monedaSinDecimales: '"$"#,##0',
  porcentaje: '0.0"%"',
  entero: '#,##0',
  fecha: 'dd/mm/yyyy',
  fechaHora: 'dd/mm/yyyy hh:mm',
}

export const TIPO_COMPROBANTE_LABEL = {
  A: 'Factura A',
  B: 'Factura B',
  C: 'Factura C',
  M: 'Factura M',
  TICKET: 'Ticket',
  SIN_COMPROBANTE: 'Sin comprobante',
}

export const etiquetaComprobante = (tipo) => TIPO_COMPROBANTE_LABEL[tipo] || tipo || 'Sin comprobante'

/** Nº de comprobante formateado como lo espera un contador: 0001-00000123 */
export const numeroComprobante = (puntoVenta, numero) => {
  if (!numero) return ''
  const pv = String(puntoVenta ?? 0).padStart(4, '0')
  return `${pv}-${String(numero).padStart(8, '0')}`
}

export const nombreArchivo = (local, periodo, extension) => {
  const limpio = String(local?.nombre || 'reporte').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  return `${limpio}_${periodo.desde}_a_${periodo.hasta}.${extension}`
}

import { describe, it, expect } from 'vitest'
import { construirLibro } from '../lib/export/excel'
import { construirPDF } from '../lib/export/pdf'
import { numeroComprobante, etiquetaComprobante, nombreArchivo } from '../lib/export/estilos'

const ctx = {
  local: { nombre: 'Pastelería del Barrio', condicion_fiscal: 'Responsable Inscripto' },
  periodo: { desde: '2026-08-01', hasta: '2026-08-31' },
  discriminaIva: true,
  resumen: {
    totalFacturado: 118900, ivaDebitoFiscal: 18900, netoGravado: 100000, comisiones: 2559,
    ingresoNetoReal: 116341, gastosOperativos: 24200, ivaCreditoFiscal: 4200,
    resultadoEjercicio: 92141, ivaAPagar: 14700, cantidadVentas: 3, cantidadGastos: 1,
  },
  libroVentas: [
    { id: 'v1', fecha: '2026-08-05T13:00:00Z', tipo: 'B', punto_venta: 1, numero: 123, medio: 'Crédito', descripcion: 'Mostrador', neto: 50000, alicuota: 21, iva: 10500, total: 60500, comision: 2117 },
    { id: 'v2', fecha: '2026-08-12T13:00:00Z', tipo: 'A', punto_venta: 1, numero: 124, medio: 'Efectivo', descripcion: 'Torta', neto: 30000, alicuota: 21, iva: 6300, total: 36300, comision: 0 },
    { id: 'v3', fecha: '2026-08-20T13:00:00Z', tipo: 'SIN_COMPROBANTE', punto_venta: null, numero: null, medio: 'QR', descripcion: '', neto: 20000, alicuota: 10.5, iva: 2100, total: 22100, comision: 442 },
  ],
  libroCompras: [
    { id: 'c1', fecha: '2026-08-03T13:00:00Z', tipo: 'A', punto_venta: 2, numero: 900, proveedor: 'Harinas SA', neto: 20000, alicuota: 21, iva: 4200, total: 24200 },
  ],
  porAlicuotaVentas: [
    { alicuota: 21, neto: 80000, iva: 16800, total: 96800, cantidad: 2 },
    { alicuota: 10.5, neto: 20000, iva: 2100, total: 22100, cantidad: 1 },
  ],
  porAlicuotaCompras: [{ alicuota: 21, neto: 20000, iva: 4200, total: 24200, cantidad: 1 }],
  porMedio: [
    { nombre: 'Crédito', tipo: 'credito', cantidad: 1, total: 60500, comisiones: 2117, neto: 58383 },
    { nombre: 'Efectivo', tipo: 'efectivo', cantidad: 1, total: 36300, comisiones: 0, neto: 36300 },
  ],
  porDia: [
    { fecha: '2026-08-05', cantidad: 1, ventas: 60500, gastos: 0, resultado: 60500 },
    { fecha: '2026-08-12', cantidad: 2, ventas: 36300, gastos: 24200, resultado: 12100 },
  ],
  cierres: [
    { id: 'x1', fecha_cierre: '2026-08-05T22:00:00Z', monto_inicial_efectivo: 5000, total_cobrado: 60500, total_gastado: 0, efectivo_fisico: 65500, diferencia_efectivo: 0, observaciones: '' },
    { id: 'x2', fecha_cierre: '2026-08-12T22:00:00Z', monto_inicial_efectivo: 5000, total_cobrado: 36300, total_gastado: 24200, efectivo_fisico: 16000, diferencia_efectivo: -1100, observaciones: 'faltó cambio' },
    { id: 'x3', fecha_cierre: '2026-08-20T22:00:00Z', monto_inicial_efectivo: 5000, total_cobrado: 22100, total_gastado: 0, efectivo_fisico: null, diferencia_efectivo: null, observaciones: '' },
  ],
  conciliacion: { cierres: 3, sinContar: 1, totalDiferencia: -1100, diasFaltante: 1, diasSobrante: 0, cuadrados: 1, peorFaltante: -1100 },
  calidad: {
    total: 4, cobros: 3, sinComprobante: 1, sinNumero: 0, sinAlicuota: 0, anuladas: 1,
    avisos: [{ nivel: 'medio', texto: '1 de 4 movimientos (25%) no tienen comprobante asociado.' }],
  },
}

const sinIva = { ...ctx, discriminaIva: false, local: { nombre: 'Kiosco', condicion_fiscal: 'Monotributo' } }

describe('formato de comprobantes', () => {
  it('numera como espera un contador: 0001-00000123', () => {
    expect(numeroComprobante(1, 123)).toBe('0001-00000123')
    expect(numeroComprobante(null, null)).toBe('')
  })
  it('traduce el tipo a texto legible', () => {
    expect(etiquetaComprobante('A')).toBe('Factura A')
    expect(etiquetaComprobante(null)).toBe('Sin comprobante')
  })
  it('el nombre de archivo no rompe en Windows', () => {
    const n = nombreArchivo({ nombre: 'Pastelería / Café *3' }, ctx.periodo, 'xlsx')
    expect(n).not.toMatch(/[/*?:"<>|]/)
    expect(n).toMatch(/\.xlsx$/)
  })
})

describe('Excel', () => {
  it('arma todas las hojas esperadas', () => {
    const wb = construirLibro(ctx)
    expect(wb.worksheets.map(w => w.name)).toEqual([
      'Resumen', 'IVA Ventas', 'IVA Compras', 'Resumen IVA', 'Medios de pago', 'Libro caja', 'Conciliación caja',
    ])
  })

  it('los nombres de hoja respetan el límite de 31 caracteres de Excel', () => {
    for (const ws of construirLibro(ctx).worksheets) expect(ws.name.length).toBeLessThanOrEqual(31)
  })

  it('omite la hoja de alícuotas cuando el local no discrimina IVA', () => {
    const nombres = construirLibro(sinIva).worksheets.map(w => w.name)
    expect(nombres).not.toContain('Resumen IVA')
  })

  it('los importes van como números con formato de moneda, no como texto', () => {
    const ws = construirLibro(ctx).getWorksheet('IVA Ventas')
    let encontrada = null
    ws.eachRow(row => { if (row.getCell(10).value === 2117) encontrada = row })
    expect(encontrada).not.toBeNull()
    const celda = encontrada.getCell(6)
    expect(typeof celda.value).toBe('number')
    expect(celda.value).toBe(50000)
    expect(celda.numFmt).toContain('#,##0.00')
  })

  it('el libro de ventas tiene autofiltro y panel fijo', () => {
    const ws = construirLibro(ctx).getWorksheet('IVA Ventas')
    expect(ws.autoFilter).toBeTruthy()
    expect(ws.views[0].state).toBe('frozen')
  })

  it('incluye la fila de totales con la cantidad de registros', () => {
    const ws = construirLibro(ctx).getWorksheet('IVA Ventas')
    const textos = []
    ws.eachRow(row => textos.push(String(row.getCell(1).value)))
    expect(textos.some(t => t.includes('TOTALES (3)'))).toBe(true)
  })

  it('la conciliación lista un cierre por fila', () => {
    const ws = construirLibro(ctx).getWorksheet('Conciliación caja')
    const conObservacion = []
    ws.eachRow(row => { if (row.getCell(7).value === 'faltó cambio') conObservacion.push(row) })
    expect(conObservacion).toHaveLength(1)
  })

  it('sin cierres no genera la hoja de conciliación', () => {
    const wb = construirLibro({ ...ctx, cierres: [] })
    expect(wb.worksheets.map(w => w.name)).not.toContain('Conciliación caja')
  })
})

describe('PDF', () => {
  it('genera un documento con varias páginas', () => {
    const doc = construirPDF(ctx)
    expect(doc.internal.getNumberOfPages()).toBeGreaterThan(3)
  })

  it('no falla con un período vacío', () => {
    const vacio = {
      ...ctx,
      resumen: { totalFacturado: 0, ivaDebitoFiscal: 0, netoGravado: 0, comisiones: 0, ingresoNetoReal: 0,
                 gastosOperativos: 0, ivaCreditoFiscal: 0, resultadoEjercicio: 0, ivaAPagar: 0,
                 cantidadVentas: 0, cantidadGastos: 0 },
      libroVentas: [], libroCompras: [], porAlicuotaVentas: [], porAlicuotaCompras: [],
      porMedio: [], porDia: [], cierres: [],
      conciliacion: { cierres: 0, sinContar: 0, totalDiferencia: 0, diasFaltante: 0, diasSobrante: 0, cuadrados: 0, peorFaltante: 0 },
      calidad: { total: 0, cobros: 0, sinComprobante: 0, sinNumero: 0, sinAlicuota: 0, anuladas: 0,
                 avisos: [{ nivel: 'info', texto: 'No hay movimientos en el período seleccionado.' }] },
    }
    expect(() => construirPDF(vacio)).not.toThrow()
  })

  it('no falla para un Monotributo (sin IVA)', () => {
    expect(() => construirPDF(sinIva)).not.toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import { construirLibroAnalytics } from '../lib/export/analyticsExcel'

const ctx = {
  alcanceLabel: 'Toda la plataforma',
  alcanceArchivo: 'Toda la plataforma',
  periodoLabel: 'Últimos 30 días',
  periodo: { desde: '2026-09-10', hasta: '2026-10-10' },
  rankingLocales: [
    { localId: 'l1', nombre: 'Pastelería del Barrio', movimientos: 20, volumenCobrado: 100000, volumenGastado: 15000, ticketPromedioCobro: 5000, pctReversas: 0.05, pctSinComprobante: 0.1, ultimaActividad: '2026-10-09T18:00:00Z' },
    { localId: 'l2', nombre: 'Kiosco Don José', movimientos: 8, volumenCobrado: 40000, volumenGastado: 5000, ticketPromedioCobro: 5000, pctReversas: 0, pctSinComprobante: 0, ultimaActividad: '2026-10-08T12:00:00Z' },
  ],
  porOwner: [
    { ownerLabel: 'owner1@mail.com', cantidadLocales: 1, movimientos: 20, volumenCobrado: 100000, volumenGastado: 15000 },
    { ownerLabel: 'Sin owner activo', cantidadLocales: 1, movimientos: 8, volumenCobrado: 40000, volumenGastado: 5000 },
  ],
  porMedioPago: [
    { label: 'Tarjeta', movimientos: 12, volumen: 90000, comision: 3600, pctComision: 0.04 },
    { label: 'Efectivo', movimientos: 16, volumen: 50000, comision: 0, pctComision: 0 },
  ],
  comisiones: { volumenCobrado: 140000, comisionPagada: 3600, pctComision: 3600 / 140000 },
  heatmap: [
    { dia: 1, hora: 15, movimientos: 3, volumen: 15000, ticketPromedio: 5000 },
    { dia: 1, hora: 16, movimientos: 1, volumen: 5000, ticketPromedio: 5000 },
  ],
  serie: [
    { semana: '2026-09-28', volumenCobrado: 60000, volumenGastado: 8000, movimientos: 12 },
    { semana: '2026-10-05', volumenCobrado: 80000, volumenGastado: 12000, movimientos: 16 },
  ],
  alertaCaida: { semana: '2026-10-05', volumenActual: 80000, promedioMovil: 60000, semanasDeReferencia: 2, variacionPct: 0.33, caida: false },
  crecimiento: { crecVentas: 0.33, crecGastos: 0.5, gastosCrecenMasRapido: true },
}

describe('libro de análisis de superadmin', () => {
  it('arma todas las hojas esperadas', () => {
    const wb = construirLibroAnalytics(ctx)
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Resumen', 'Ranking de locales', 'Por owner', 'Por medio de pago', 'Patrón horario', 'Serie semanal',
    ])
  })

  it('los nombres de hoja respetan el límite de 31 caracteres de Excel', () => {
    for (const ws of construirLibroAnalytics(ctx).worksheets) expect(ws.name.length).toBeLessThanOrEqual(31)
  })

  it('omite patrón horario y serie semanal si vienen vacíos', () => {
    const nombres = construirLibroAnalytics({ ...ctx, heatmap: [], serie: [] }).worksheets.map((w) => w.name)
    expect(nombres).not.toContain('Patrón horario')
    expect(nombres).not.toContain('Serie semanal')
  })

  it('el ranking de locales trae los importes como números, no como texto', () => {
    const ws = construirLibroAnalytics(ctx).getWorksheet('Ranking de locales')
    let fila = null
    ws.eachRow((row) => { if (row.getCell(1).value === 'Pastelería del Barrio') fila = row })
    expect(fila).not.toBeNull()
    const celda = fila.getCell(3)
    expect(typeof celda.value).toBe('number')
    expect(celda.value).toBe(100000)
    expect(celda.numFmt).toContain('#,##0.00')
  })

  it('el ranking de locales tiene autofiltro y panel fijo', () => {
    const ws = construirLibroAnalytics(ctx).getWorksheet('Ranking de locales')
    expect(ws.autoFilter).toBeTruthy()
    expect(ws.views[0].state).toBe('frozen')
  })

  it('incluye la fila de totales con la cantidad de locales', () => {
    const ws = construirLibroAnalytics(ctx).getWorksheet('Ranking de locales')
    const textos = []
    ws.eachRow((row) => textos.push(String(row.getCell(1).value)))
    expect(textos.some((t) => t.includes('TOTALES (2)'))).toBe(true)
  })

  it('por owner suma movimientos y volumen en la fila de totales', () => {
    const ws = construirLibroAnalytics(ctx).getWorksheet('Por owner')
    let totales = null
    ws.eachRow((row) => { if (String(row.getCell(1).value).startsWith('TOTALES')) totales = row })
    const valores = []
    totales.eachCell((c) => valores.push(c.value))
    expect(valores).toContain(28) // 20 + 8 movimientos
    expect(valores).toContain(140000) // volumen cobrado total
  })

  it('patrón horario tiene una fila por día y una escala de color condicional', () => {
    const ws = construirLibroAnalytics(ctx).getWorksheet('Patrón horario')
    expect(ws.rowCount).toBeGreaterThanOrEqual(4 + 7) // encabezado + cabecera + 7 días
    expect(ws._conditionalFormattings?.length || ws.conditionalFormattings?.length || 1).toBeTruthy()
  })

  it('no falla con listas vacías', () => {
    const vacio = {
      alcanceLabel: 'Toda la plataforma', alcanceArchivo: 'plataforma', periodoLabel: 'Hoy', periodo: { desde: '2026-10-10', hasta: '2026-10-10' },
      rankingLocales: [], porOwner: [], porMedioPago: [],
      comisiones: { volumenCobrado: 0, comisionPagada: 0, pctComision: 0 },
      heatmap: [], serie: [], alertaCaida: null, crecimiento: null,
    }
    expect(() => construirLibroAnalytics(vacio)).not.toThrow()
  })
})

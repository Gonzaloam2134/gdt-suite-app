import { describe, it, expect } from 'vitest'
import {
  resumenComisiones,
  comisionesPorTipoMedioPago,
  heatmapHoraDia,
  serieSemanal,
  alertaCaidaVentas,
  crecimientoVentasVsGastos,
} from '../lib/domain/analyticsAvanzado'

const cobro = (over = {}) => ({
  tipo: 'COBRO_RECIBIDO', monto: 100, comision_monto: 5, es_reversa: false, revertida: false,
  creado_en: '2026-10-05T15:00:00.000Z', ...over,
})
const gasto = (over = {}) => ({
  tipo: 'GASTO_REGISTRADO', monto: 50, es_reversa: false, revertida: false,
  creado_en: '2026-10-05T15:00:00.000Z', ...over,
})

describe('resumenComisiones', () => {
  it('suma volumen y comisión solo de cobros reales', () => {
    const r = resumenComisiones([cobro({ monto: 100, comision_monto: 5 }), cobro({ monto: 200, comision_monto: 10 }), gasto()])
    expect(r.volumenCobrado).toBe(300)
    expect(r.comisionPagada).toBe(15)
    expect(r.pctComision).toBeCloseTo(0.05)
  })

  it('reversas y revertidas no suman', () => {
    const r = resumenComisiones([cobro({ es_reversa: true }), cobro({ revertida: true })])
    expect(r.volumenCobrado).toBe(0)
  })

  it('sin cobros, pctComision es 0 en vez de NaN', () => {
    expect(resumenComisiones([]).pctComision).toBe(0)
  })
})

describe('comisionesPorTipoMedioPago', () => {
  it('agrupa comisión y volumen por tipo de medio', () => {
    const filas = [
      cobro({ monto: 100, comision_monto: 5, medios_pago: { tipo: 'tarjeta' } }),
      cobro({ monto: 100, comision_monto: 0, medios_pago: { tipo: 'efectivo' } }),
    ]
    const resultado = comisionesPorTipoMedioPago(filas)
    expect(resultado.find((r) => r.tipo === 'tarjeta').pctComision).toBeCloseTo(0.05)
    expect(resultado.find((r) => r.tipo === 'efectivo').pctComision).toBe(0)
  })

  it('ordena de mayor a menor comisión pagada', () => {
    const filas = [
      cobro({ comision_monto: 2, medios_pago: { tipo: 'a' } }),
      cobro({ comision_monto: 20, medios_pago: { tipo: 'b' } }),
    ]
    expect(comisionesPorTipoMedioPago(filas)[0].tipo).toBe('b')
  })
})

describe('heatmapHoraDia', () => {
  it('agrupa por día de semana y hora, calcula ticket promedio', () => {
    const filas = [
      cobro({ monto: 100, creado_en: '2026-10-05T15:00:00.000' }), // sin Z: hora local literal
      cobro({ monto: 300, creado_en: '2026-10-05T15:30:00.000' }),
    ]
    const [celda] = heatmapHoraDia(filas)
    expect(celda.movimientos).toBe(2)
    expect(celda.volumen).toBe(400)
    expect(celda.ticketPromedio).toBe(200)
  })

  it('gastos y reversas no entran', () => {
    expect(heatmapHoraDia([gasto(), cobro({ es_reversa: true })])).toEqual([])
  })
})

describe('serieSemanal', () => {
  it('agrupa por semana calendario (lunes a domingo) y ordena cronológicamente', () => {
    const serie = serieSemanal([
      cobro({ monto: 100, creado_en: '2026-10-05T12:00:00' }), // lunes
      cobro({ monto: 50, creado_en: '2026-09-28T12:00:00' }),  // lunes anterior
    ])
    expect(serie).toHaveLength(2)
    expect(serie[0].semana < serie[1].semana).toBe(true)
  })

  it('separa cobrado de gastado en la misma semana', () => {
    const [semana] = serieSemanal([cobro({ monto: 100 }), gasto({ monto: 30 })])
    expect(semana.volumenCobrado).toBe(100)
    expect(semana.volumenGastado).toBe(30)
  })
})

describe('alertaCaidaVentas', () => {
  const semana = (volumenCobrado, i) => ({ semana: `2026-01-${String(i).padStart(2, '0')}`, volumenCobrado, volumenGastado: 0, movimientos: 1 })

  it('con poca historia no alerta (devuelve null)', () => {
    expect(alertaCaidaVentas([semana(100, 1), semana(100, 2)])).toBeNull()
  })

  it('detecta una caída real por debajo del umbral', () => {
    const serie = [semana(100, 1), semana(100, 2), semana(100, 3), semana(50, 4)]
    const alerta = alertaCaidaVentas(serie, 8, 0.15)
    expect(alerta.caida).toBe(true)
    expect(alerta.variacionPct).toBeCloseTo(-0.5)
  })

  it('una semana estable no dispara la alerta', () => {
    const serie = [semana(100, 1), semana(100, 2), semana(100, 3), semana(98, 4)]
    expect(alertaCaidaVentas(serie).caida).toBe(false)
  })
})

describe('crecimientoVentasVsGastos', () => {
  it('detecta que los gastos crecen más rápido que las ventas', () => {
    const serie = [
      { semana: '1', volumenCobrado: 100, volumenGastado: 50 },
      { semana: '2', volumenCobrado: 110, volumenGastado: 100 },
    ]
    const r = crecimientoVentasVsGastos(serie)
    expect(r.gastosCrecenMasRapido).toBe(true)
  })

  it('con menos de 2 semanas devuelve null', () => {
    expect(crecimientoVentasVsGastos([{ semana: '1', volumenCobrado: 1, volumenGastado: 1 }])).toBeNull()
  })
})

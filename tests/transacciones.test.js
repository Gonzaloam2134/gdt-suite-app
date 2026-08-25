import { describe, it, expect } from 'vitest'
import { calcularComision, calcularIva, calcularTotalesDia, calcularResumenPeriodo, efectivoEsperado } from '../lib/domain/transacciones'

const efectivo = { nombre: 'Efectivo', tipo: 'efectivo', comision_porcentaje: 0, plazo_acreditacion_dias: 0 }
const credito  = { nombre: 'Crédito',  tipo: 'credito',  comision_porcentaje: 3.5, plazo_acreditacion_dias: 30 }
const debito   = { nombre: 'Débito',   tipo: 'debito',   comision_porcentaje: 0, plazo_acreditacion_dias: 0 }

let n = 0
const tx = (over) => ({
  id: `tx-${++n}`, tipo: 'COBRO_RECIBIDO', monto: 1000, es_reversa: false, revertida: false,
  creado_en: new Date(2026, 7, 25, 10, 0).toISOString(), medios_pago: efectivo, ...over,
})

describe('cálculos unitarios', () => {
  it('comisión', () => expect(calcularComision(1000, 3.5)).toBe(35))
  it('IVA 21% desde bruto', () => expect(calcularIva(1210, 21)).toEqual({ neto: 1000, iva: 210 }))
  it('IVA 10.5%', () => expect(calcularIva(1105, 10.5)).toEqual({ neto: 1000, iva: 105 }))
  it('IVA 0%', () => expect(calcularIva(1000, 0)).toEqual({ neto: 1000, iva: 0 }))
})

describe('calcularTotalesDia', () => {
  const DIA = '2026-08-25'

  it('un cobro a las 22:30 hora local cuenta en el día (bug UTC)', () => {
    const t = tx({ creado_en: new Date(2026, 7, 25, 22, 30).toISOString() })
    const { totales } = calcularTotalesDia([t], DIA)
    expect(totales.cobros).toBe(1000)
    expect(totales.efectivoEnCaja).toBe(1000)
  })

  it('efectivo va a caja; débito se acredita hoy; crédito queda pendiente neto de comisión', () => {
    const r = calcularTotalesDia([
      tx({ monto: 1000, medios_pago: efectivo }),
      tx({ monto: 2000, medios_pago: debito }),
      tx({ monto: 3000, medios_pago: credito }),
    ], DIA)
    expect(r.totales.cobros).toBe(6000)
    expect(r.totales.efectivoEnCaja).toBe(1000)
    expect(r.totales.disponibleHoy).toBe(2000)
    expect(r.totales.pendienteAcreditacion).toBe(3000 - 105)
    expect(r.totales.comisiones).toBe(105)
    expect(r.acreditacionesHoy).toHaveLength(1)
    expect(r.desgloseMedios[0].nombre).toBe('Crédito')
  })

  it('gastos restan del neto real', () => {
    const r = calcularTotalesDia([tx({ monto: 5000 }), tx({ tipo: 'GASTO_REGISTRADO', monto: 1200 })], DIA)
    expect(r.totales.gastos).toBe(1200)
    expect(r.totales.netoReal).toBe(3800)
    expect(r.gastos).toHaveLength(1)
  })

  it('una transacción revertida NO suma (bug de doble conteo)', () => {
    const original = tx({ id: 'orig', monto: 10000, revertida: true })
    const reversa = tx({ monto: -10000, es_reversa: true, reversa_de: 'orig' })
    const r = calcularTotalesDia([original, reversa], DIA)
    expect(r.totales.cobros).toBe(0)
    expect(r.cobros).toHaveLength(0)
  })

  it('usa comision_monto guardada si existe', () => {
    const r = calcularTotalesDia([tx({ monto: 1000, medios_pago: credito, comision_monto: 50 })], DIA)
    expect(r.totales.comisiones).toBe(50)
  })

  it('efectivo esperado = inicial + efectivo del día', () => {
    expect(efectivoEsperado(500, { efectivoEnCaja: 1000 })).toBe(1500)
  })
})

describe('calcularResumenPeriodo', () => {
  it('lee monto_iva/monto_neto guardados', () => {
    const { resumen, libroVentas } = calcularResumenPeriodo([
      tx({ monto: 1210, monto_neto: 1000, monto_iva: 210, alicuota_iva: 21, tipo_comprobante: 'B', medios_pago: credito, comision_monto: 42.35 }),
      tx({ tipo: 'GASTO_REGISTRADO', monto: 605, monto_neto: 500, monto_iva: 105, alicuota_iva: 21 }),
    ])
    expect(resumen.totalFacturado).toBe(1210)
    expect(resumen.ivaDebitoFiscal).toBe(210)
    expect(resumen.netoGravado).toBe(1000)
    expect(resumen.comisiones).toBe(42.35)
    expect(resumen.ingresoNetoReal).toBe(1167.65)
    expect(resumen.gastosOperativos).toBe(605)
    expect(resumen.ivaCreditoFiscal).toBe(105)
    expect(resumen.ivaAPagar).toBe(105)
    expect(resumen.resultadoEjercicio).toBe(562.65)
    expect(libroVentas[0].tipo).toBe('B')
  })

  it('monotributo: no discrimina IVA', () => {
    const { resumen } = calcularResumenPeriodo([tx({ monto: 1210, monto_iva: 210, monto_neto: 1000 })], { discriminaIva: false })
    expect(resumen.ivaDebitoFiscal).toBe(0)
    expect(resumen.netoGravado).toBe(1210)
  })

  it('fila vieja sin monto_iva: deriva de alicuota (default 21)', () => {
    const { resumen } = calcularResumenPeriodo([tx({ monto: 1210, monto_iva: 0, monto_neto: 0 })])
    expect(resumen.ivaDebitoFiscal).toBe(210)
  })

  it('excluye reversas y revertidas', () => {
    const { resumen } = calcularResumenPeriodo([
      tx({ id: 'o', monto: 1000, revertida: true }), tx({ monto: -1000, es_reversa: true, reversa_de: 'o' }),
    ])
    expect(resumen.totalFacturado).toBe(0)
    expect(resumen.cantidadVentas).toBe(0)
  })
})

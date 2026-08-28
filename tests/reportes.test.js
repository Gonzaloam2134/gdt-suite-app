import { describe, it, expect } from 'vitest'
import { agruparPorAlicuota, agruparPorMedio, agruparPorDia, evaluarCalidad, conciliarCierres } from '../lib/domain/reportes'

const credito = { nombre: 'Crédito', tipo: 'credito', comision_porcentaje: 3.5, plazo_acreditacion_dias: 30 }
const efectivo = { nombre: 'Efectivo', tipo: 'efectivo', comision_porcentaje: 0, plazo_acreditacion_dias: 0 }

let n = 0
const tx = (over) => ({
  id: `t-${++n}`, tipo: 'COBRO_RECIBIDO', monto: 1000, es_reversa: false, revertida: false,
  creado_en: new Date(2026, 7, 10, 10, 0).toISOString(), medios_pago: efectivo,
  tipo_comprobante: 'B', nro_comprobante: 1, alicuota_iva: 21, ...over,
})

describe('agruparPorAlicuota', () => {
  it('separa 21 y 10.5 y ordena de mayor a menor', () => {
    const r = agruparPorAlicuota([
      { alicuota: 21, neto: 1000, iva: 210, total: 1210 },
      { alicuota: 21, neto: 500, iva: 105, total: 605 },
      { alicuota: 10.5, neto: 200, iva: 21, total: 221 },
    ])
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ alicuota: 21, neto: 1500, iva: 315, cantidad: 2 })
    expect(r[1]).toMatchObject({ alicuota: 10.5, cantidad: 1 })
  })
})

describe('agruparPorMedio', () => {
  it('suma por medio, calcula comisión y excluye anuladas', () => {
    const r = agruparPorMedio([
      tx({ monto: 1000, medios_pago: credito }),
      tx({ monto: 3000, medios_pago: credito }),
      tx({ monto: 500, medios_pago: efectivo }),
      tx({ monto: 9999, medios_pago: credito, revertida: true }),
      tx({ monto: -9999, es_reversa: true }),
    ])
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ nombre: 'Crédito', total: 4000, comisiones: 140, neto: 3860, cantidad: 2 })
    expect(r[1]).toMatchObject({ nombre: 'Efectivo', total: 500, comisiones: 0 })
  })
})

describe('agruparPorDia', () => {
  it('agrupa por fecha local y calcula resultado', () => {
    const r = agruparPorDia([
      tx({ monto: 1000, creado_en: new Date(2026, 7, 10, 9, 0).toISOString() }),
      tx({ monto: 500, tipo: 'GASTO_REGISTRADO', creado_en: new Date(2026, 7, 10, 18, 0).toISOString() }),
      // 22:30 hora local: sigue siendo el día 11, no el 12 en UTC
      tx({ monto: 700, creado_en: new Date(2026, 7, 11, 22, 30).toISOString() }),
    ])
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ fecha: '2026-08-10', ventas: 1000, gastos: 500, resultado: 500 })
    expect(r[1]).toMatchObject({ fecha: '2026-08-11', ventas: 700 })
  })
})

describe('evaluarCalidad', () => {
  it('avisa cuando faltan comprobantes', () => {
    const c = evaluarCalidad([
      tx({ tipo_comprobante: 'SIN_COMPROBANTE' }),
      tx({ tipo_comprobante: 'SIN_COMPROBANTE' }),
      tx({ tipo_comprobante: 'B', nro_comprobante: 5 }),
    ])
    expect(c.sinComprobante).toBe(2)
    expect(c.avisos.some(a => a.nivel === 'alto')).toBe(true)
  })

  it('avisa comprobantes sin número y cuenta anuladas', () => {
    const c = evaluarCalidad([
      tx({ tipo_comprobante: 'A', nro_comprobante: null }),
      tx({ revertida: true }),
    ])
    expect(c.sinNumero).toBe(1)
    expect(c.anuladas).toBe(1)
    expect(c.total).toBe(1)   // la anulada no cuenta como válida
  })

  it('sin movimientos lo dice explícitamente', () => {
    expect(evaluarCalidad([]).avisos[0].nivel).toBe('info')
  })
})

describe('conciliarCierres', () => {
  it('separa faltantes, sobrantes y cierres sin conteo', () => {
    const c = conciliarCierres([
      { id: 1, diferencia_efectivo: -500 },
      { id: 2, diferencia_efectivo: 0 },
      { id: 3, diferencia_efectivo: 200 },
      { id: 4, diferencia_efectivo: null },
      { id: 5, diferencia_efectivo: -1200 },
    ])
    expect(c).toMatchObject({
      cierres: 5, sinContar: 1, diasFaltante: 2, diasSobrante: 1, cuadrados: 1,
      totalDiferencia: -1500, peorFaltante: -1200,
    })
  })
})

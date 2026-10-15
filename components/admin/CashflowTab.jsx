import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../../lib/format'
import { agruparPagosPorMes, proyectarCashflow, totalCobradoHistorico, mrrActual } from '../../lib/domain/cashflow'
import Icono from '../ui/Icono'

export default function CashflowTab({ pagosSuscripcion, suscripciones, usuarios }) {
  const MESES_ATRAS = 6
  const MESES_ADELANTE = 6
  const ahora = new Date()

  const pagosPorMes = agruparPagosPorMes(pagosSuscripcion)
  const historico = []
  for (let i = MESES_ATRAS - 1; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    historico.push({ mes: clave, real: pagosPorMes[clave] || 0, proyectado: null })
  }

  const proximoMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1)
  const proximoMesISO = `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, '0')}-01`
  const proyeccion = proyectarCashflow(suscripciones, MESES_ADELANTE, proximoMesISO)
  const futuro = Object.entries(proyeccion).map(([mes, monto]) => ({ mes, real: null, proyectado: monto }))

  const datosGrafico = [...historico, ...futuro]
  const total = totalCobradoHistorico(pagosSuscripcion)
  const mrr = mrrActual(suscripciones)

  const nombrePorOwner = (ownerId) => usuarios.find(u => u.id === ownerId)?.nombre || usuarios.find(u => u.id === ownerId)?.email || 'Desconocido'

  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-500/30 rounded-lg p-4">
        <p className="text-sm text-primary-700 m-0">
          <Icono nombre="dinero" size={16} className="inline-block align-text-bottom mr-1.5 " />Lo que ya cobraste, y una proyección de lo que deberías seguir cobrando si nadie
          cancela ni falla ningún pago — es optimista a propósito, no una garantía.
        </p>
      </div>>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="text-xs text-gray-500 font-semibold uppercase">Cobrado hasta hoy</div>>
          <div className="text-2xl font-extrabold text-green-700 mt-1">{formatCurrency(total)}</div>>
        </div>>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="text-xs text-gray-500 font-semibold uppercase">Ingreso mensual recurrente (MRR)</div>>
          <div className="text-2xl font-extrabold text-primary-700 mt-1">{formatCurrency(mrr)}</div>>
          <div className="text-xs text-gray-400 mt-1">Suscripciones activas hoy — las anuales cuentan a 1/12</div>>
        </div>>
      </div>>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-bold text-gray-900 mb-1">Real vs. proyectado, mes a mes</h3>
        <p className="text-xs text-gray-500 mb-4">
          Barras verdes: lo que ya entró. Barras celestes: lo que se espera si las
          suscripciones activas de hoy se renuevan sin cortes.
        </p>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={datosGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => v == null ? '—' : formatCurrency(v)} />
              <Legend />
              <Bar dataKey="real" name="Cobrado" fill="#019C62" radius={[4, 4, 0, 0]} />
              <Bar dataKey="proyectado" name="Proyectado" fill="#9ADBC0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>>
      </div>>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-bold text-gray-900 mb-3">Detalle de pagos ({pagosSuscripcion.length})</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {pagosSuscripcion.map(pago => (
            <div key={pago.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg text-sm">
              <div>
                <div className="font-semibold text-gray-800">{nombrePorOwner(pago.owner_id)}</div>>
                <div className="text-xs text-gray-500">
                  {pago.segmento} · {pago.ciclo} · {new Date(pago.procesado_en).toLocaleDateString('es-AR')}
                </div>>
              </div>>
              <div className="font-bold text-green-700">{formatCurrency(pago.monto)}</div>>
            </div>>
          ))}
          {pagosSuscripcion.length === 0 && (
            <p className="text-gray-500 text-sm m-0">Todavía no hay pagos registrados.</p>
          )}
        </div>>
      </div>>
    </div>>
  )
}

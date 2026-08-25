import { useState } from 'react'
import Modal from '../ui/Modal'
import { formatCurrency } from '../../lib/format'
import { efectivoEsperado } from '../../lib/domain/transacciones'

const Dato = ({ label, valor, className = 'text-gray-900' }) => (
  <div><div className="text-xs text-gray-500">{label}</div><div className={`font-bold ${className}`}>{valor}</div></div>
)

export default function CierreCajaModal({ isOpen, onClose, onConfirmar, cajaAbierta, totales, procesando }) {
  const [efectivoFisico, setEfectivoFisico] = useState('')
  const [observaciones, setObservaciones] = useState('')
  if (!cajaAbierta) return null

  const esperado = efectivoEsperado(cajaAbierta.monto_inicial_efectivo, totales)
  const fisico = efectivoFisico === '' ? null : parseFloat(efectivoFisico)
  const diferencia = fisico === null ? null : Math.round((fisico - esperado) * 100) / 100

  const cerrar = () => { setEfectivoFisico(''); setObservaciones(''); onClose() }
  const confirmar = async () => { if (await onConfirmar({ efectivoFisico, observaciones })) cerrar() }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="🔒 Cerrar caja" subtitle="Revisá el día y contá el efectivo" size="lg"
      headerClassName="bg-orange-600 text-white"
      footer={<>
        <button onClick={cerrar} className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Cancelar</button>
        <button onClick={confirmar} disabled={procesando} className="px-4 py-2.5 bg-orange-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-50">
          {procesando ? 'Cerrando…' : 'Cerrar caja'}
        </button>
      </>}>
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-bold text-gray-900 mb-3 m-0">Resumen del día</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Dato label="Monto inicial" valor={formatCurrency(cajaAbierta.monto_inicial_efectivo)} />
            <Dato label="Cobros en efectivo" valor={`+${formatCurrency(totales.efectivoEnCaja)}`} className="text-green-700" />
            <Dato label="Total cobros" valor={formatCurrency(totales.cobros)} className="text-green-700" />
            <Dato label="Total gastos" valor={`-${formatCurrency(totales.gastos)}`} className="text-red-700" />
            <div className="col-span-2 pt-2 border-t border-gray-300">
              <div className="text-xs text-gray-500">Efectivo esperado en caja</div>
              <div className="text-lg font-extrabold text-blue-700">{formatCurrency(esperado)}</div>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="efectivo-fisico" className="block text-sm font-semibold text-gray-700 mb-2">Efectivo contado (opcional)</label>
          <input id="efectivo-fisico" type="number" step="0.01" min="0" inputMode="decimal" value={efectivoFisico}
            onChange={(e) => setEfectivoFisico(e.target.value)} placeholder="Contá la caja y poné el total"
            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
          {diferencia !== null && !Number.isNaN(diferencia) && (
            <div className={`mt-2 p-2 rounded text-xs font-semibold ${
              diferencia === 0 ? 'bg-green-100 text-green-800' : diferencia > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
              {diferencia === 0 && '✅ La caja cuadra'}
              {diferencia > 0 && `Sobran ${formatCurrency(diferencia)}`}
              {diferencia < 0 && `Faltan ${formatCurrency(Math.abs(diferencia))}`}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="observaciones" className="block text-sm font-semibold text-gray-700 mb-2">Observaciones (opcional)</label>
          <textarea id="observaciones" rows="3" value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej: faltó cambio, se pagó un flete de la caja"
            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none" />
        </div>
      </div>
    </Modal>
  )
}

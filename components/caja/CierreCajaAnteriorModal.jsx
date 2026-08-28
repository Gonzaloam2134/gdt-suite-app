import { useState } from 'react'
import Modal from '../ui/Modal'
import { formatCurrency, formatFechaLarga } from '../../lib/format'

const Dato = ({ label, valor, className = 'text-gray-900' }) => (
  <div><div className="text-xs text-gray-500">{label}</div><div className={`font-bold ${className}`}>{valor}</div></div>
)

/**
 * Cierra una caja que quedó abierta de un día anterior (huérfana). A diferencia
 * de `CierreCajaModal`, no pide efectivo contado: nadie contó esa caja ese día,
 * así que se deja sin dato en vez de simular que cuadró.
 */
export default function CierreCajaAnteriorModal({ isOpen, onClose, onConfirmar, caja, totales, loading, procesando }) {
  const [nota, setNota] = useState('')
  if (!caja) return null

  const cerrar = () => { setNota(''); onClose() }
  const confirmar = async () => { if (await onConfirmar(nota)) cerrar() }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="🔒 Cerrar caja anterior"
      subtitle={`Quedó abierta desde el ${formatFechaLarga(caja.fecha_apertura)}`} size="lg"
      headerClassName="bg-red-600 text-white"
      footer={<>
        <button onClick={cerrar} className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Cancelar</button>
        <button onClick={confirmar} disabled={procesando || loading}
          className="px-4 py-2.5 bg-red-600 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-red-700 disabled:opacity-50">
          {procesando ? 'Cerrando…' : 'Cerrar caja anterior'}
        </button>
      </>}>
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          El efectivo de ese día no se contó: la conciliación va a quedar marcada como "sin contar", no como cuadrada.
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Calculando los movimientos de ese día…</p>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 mb-3 m-0">Resumen del {formatFechaLarga(caja.fecha_apertura)}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Dato label="Monto inicial" valor={formatCurrency(caja.monto_inicial_efectivo)} />
              <Dato label="Total cobros" valor={formatCurrency(totales.cobros)} className="text-green-700" />
              <Dato label="Total gastos" valor={`-${formatCurrency(totales.gastos)}`} className="text-red-700" />
              <Dato label="Cobros en efectivo" valor={`+${formatCurrency(totales.efectivoCobrado)}`} className="text-green-700" />
            <Dato label="Gastos en efectivo" valor={`-${formatCurrency(totales.efectivoGastado)}`} className="text-red-700" />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="nota-huerfana" className="block text-sm font-semibold text-gray-700 mb-2">Nota adicional (opcional)</label>
          <textarea id="nota-huerfana" rows="2" value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: nos olvidamos de cerrar el viernes"
            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none" />
        </div>
      </div>
    </Modal>
  )
}

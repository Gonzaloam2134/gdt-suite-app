import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import { formatCurrency, formatFechaHora } from '../../lib/format'
import { esPago } from '../../lib/domain/cuentaCorriente'

/** Anula un consumo o un pago con una reversa. El original nunca se borra. */
export default function AnularMovimientoCcModal({ isOpen, onClose, movimiento, onConfirmar }) {
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  if (!movimiento) return null

  const cerrar = () => { setMotivo(''); onClose() }

  const confirmar = async () => {
    if (!motivo.trim()) return toast.error('Indicá el motivo de la cancelación')
    setGuardando(true)
    try {
      await onConfirmar(movimiento, motivo)
      toast.success('Movimiento anulado')
      cerrar()
    } catch (err) {
      toast.error(`No se pudo anular: ${err.message}`)
    } finally { setGuardando(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="↩️ Anular movimiento" subtitle="Queda registrado como anulado, no se borra"
      headerClassName="bg-amber-500 text-white"
      footer={<>
        <button onClick={cerrar} className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Volver</button>
        <button onClick={confirmar} disabled={guardando} className="px-4 py-2.5 bg-amber-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-amber-600 disabled:opacity-50">
          {guardando ? 'Anulando…' : 'Anular'}
        </button>
      </>}>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm space-y-1">
        <div className="flex justify-between"><span className="text-gray-500">Tipo</span><span className="font-semibold">{esPago(movimiento) ? 'Pago' : 'Consumo'}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Monto</span><span className="font-bold">{formatCurrency(movimiento.monto)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Fecha</span><span className="font-semibold">{formatFechaHora(movimiento.creado_en)}</span></div>
        {movimiento.descripcion && <div className="flex justify-between gap-4"><span className="text-gray-500">Descripción</span><span className="font-semibold text-right">{movimiento.descripcion}</span></div>}
        {esPago(movimiento) && movimiento.transaccion_id && (
          <p className="text-xs text-amber-700 m-0 pt-1">Esto también anula el cobro en caja vinculado a este pago.</p>
        )}
      </div>

      <label htmlFor="motivo-cc" className="block text-sm font-semibold text-gray-700 mb-2">Motivo</label>
      <textarea id="motivo-cc" rows="3" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus
        placeholder="Ej: se anotó el consumo equivocado, el padre pagó dos veces"
        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none" />
    </Modal>
  )
}

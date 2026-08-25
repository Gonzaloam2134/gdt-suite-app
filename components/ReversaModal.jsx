import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from './ui/Modal'
import { registrarReversa } from '../lib/services/transacciones'
import { registrarAccion } from '../lib/services/auditoria'
import { ACCIONES } from '../lib/constants/auditoria'
import { formatCurrency, formatHora } from '../lib/format'

/** Anula una transacción con un asiento inverso. La original nunca se borra. */
export default function ReversaModal({ isOpen, onClose, transaccion, userId, onReversaExitosa }) {
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  if (!transaccion) return null

  const cerrar = () => { setMotivo(''); onClose() }

  const confirmar = async () => {
    if (!motivo.trim()) return toast.error('Indicá el motivo de la cancelación')
    setGuardando(true)
    try {
      const reversa = await registrarReversa(transaccion, motivo)
      await registrarAccion({
        localId: transaccion.local_id, userId, accion: ACCIONES.REVERSA_REGISTRADA,
        tabla: 'transacciones', registroId: reversa.id,
        detalles: { original: transaccion.id, monto: transaccion.monto, motivo: motivo.trim() },
      })
      toast.success('Transacción cancelada')
      onReversaExitosa?.()
      cerrar()
    } catch (err) {
      toast.error(`No se pudo cancelar: ${err.message}`)
    } finally { setGuardando(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="↩️ Cancelar transacción" subtitle="Queda registrada como anulada, no se borra"
      headerClassName="bg-amber-500 text-white"
      footer={<>
        <button onClick={cerrar} className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Volver</button>
        <button onClick={confirmar} disabled={guardando} className="px-4 py-2.5 bg-amber-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-amber-600 disabled:opacity-50">
          {guardando ? 'Cancelando…' : 'Cancelar transacción'}
        </button>
      </>}>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm space-y-1">
        <div className="flex justify-between"><span className="text-gray-500">Monto</span><span className="font-bold">{formatCurrency(transaccion.monto)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Medio</span><span className="font-semibold">{transaccion.medios_pago?.nombre || '-'}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Hora</span><span className="font-semibold">{formatHora(transaccion.creado_en)}</span></div>
        {transaccion.descripcion && <div className="flex justify-between gap-4"><span className="text-gray-500">Descripción</span><span className="font-semibold text-right">{transaccion.descripcion}</span></div>}
      </div>

      <label htmlFor="motivo" className="block text-sm font-semibold text-gray-700 mb-2">Motivo</label>
      <textarea id="motivo" rows="3" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus
        placeholder="Ej: se cargó dos veces, el cliente devolvió la compra"
        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none" />
    </Modal>
  )
}

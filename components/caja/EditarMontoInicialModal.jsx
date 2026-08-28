import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { formatCurrency } from '../../lib/format'

/**
 * Corrige el monto con el que se abrió la caja. Pensado para el error de
 * tipeo típico ($6000 en vez de $600): no hace falta cerrar y volver a abrir,
 * solo mientras la caja sigue abierta — una vez cerrada ya quedó conciliada.
 */
export default function EditarMontoInicialModal({ isOpen, onClose, montoActual, onGuardar, procesando }) {
  const [monto, setMonto] = useState('')

  useEffect(() => { if (isOpen) setMonto(String(montoActual ?? '')) }, [isOpen, montoActual])

  const cerrar = () => { setMonto(''); onClose() }
  const guardar = async () => { if (await onGuardar(monto)) cerrar() }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="✏️ Corregir monto inicial" subtitle="Por si te equivocaste al abrir la caja"
      headerClassName="bg-amber-500 text-white"
      footer={<>
        <button onClick={cerrar} className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Cancelar</button>
        <button onClick={guardar} disabled={procesando} className="px-4 py-2.5 bg-amber-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-amber-600 disabled:opacity-50">
          {procesando ? 'Guardando…' : 'Corregir'}
        </button>
      </>}>
      <p className="text-xs text-gray-500 m-0 mb-3">
        Ahora está cargado como <strong>{formatCurrency(montoActual)}</strong>. Esto solo ajusta el punto de
        partida de hoy — no toca ningún cobro ni gasto que ya hayas registrado.
      </p>
      <label htmlFor="monto-corregido" className="block text-sm font-semibold text-gray-700 mb-2">Monto inicial correcto</label>
      <input id="monto-corregido" type="number" step="0.01" min="0" inputMode="decimal" value={monto} autoFocus
        onChange={(e) => setMonto(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && guardar()}
        placeholder="0,00"
        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
    </Modal>
  )
}

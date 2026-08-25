import { useState } from 'react'
import Modal from '../ui/Modal'

export default function AperturaCajaModal({ isOpen, onClose, onConfirmar, procesando }) {
  const [monto, setMonto] = useState('')

  const cerrar = () => { setMonto(''); onClose() }
  const confirmar = async () => { if (await onConfirmar(monto)) cerrar() }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="🔓 Abrir caja" subtitle="Con cuánto efectivo empezás el día"
      headerClassName="bg-emerald-600 text-white"
      footer={<>
        <button onClick={cerrar} className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Cancelar</button>
        <button onClick={confirmar} disabled={procesando} className="px-4 py-2.5 bg-emerald-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-emerald-600 disabled:opacity-50">
          {procesando ? 'Abriendo…' : 'Abrir caja'}
        </button>
      </>}>
      <label htmlFor="monto-inicial" className="block text-sm font-semibold text-gray-700 mb-2">Efectivo inicial</label>
      <input id="monto-inicial" type="number" step="0.01" min="0" inputMode="decimal" value={monto} autoFocus
        onChange={(e) => setMonto(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && confirmar()}
        placeholder="0,00"
        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
      <p className="text-xs text-gray-500 mt-2 m-0">El cambio con el que arrancás. Si no tenés efectivo inicial, poné 0.</p>
    </Modal>
  )
}

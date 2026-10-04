import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

export default function AperturaCajaModal({ isOpen, onClose, onConfirmar, procesando }) {
  const [monto, setMonto] = useState('')

  const cerrar = () => { setMonto(''); onClose() }
  const confirmar = async () => {
    if (procesando) return
    if (await onConfirmar(monto)) cerrar()
  }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Abrir caja" subtitle="Con cuánto efectivo empezás el día" size="sm"
      footer={<>
        <Button variant="secondary" onClick={cerrar} className="!rounded-[14px]">Cancelar</Button>
        <Button variant="success" onClick={confirmar} disabled={procesando} className="!rounded-[14px]">{procesando ? 'Abriendo…' : 'Abrir caja'}</Button>
      </>}>
      <label htmlFor="monto-inicial" className="block text-sm font-semibold text-gray-700 mb-2">Efectivo inicial</label>
      <input id="monto-inicial" type="number" step="0.01" min="0" inputMode="decimal" value={monto} autoFocus
        onChange={(e) => setMonto(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && confirmar()}
        placeholder="0,00"
        className="w-full p-3.5 border border-gray-300 rounded-[14px] text-lg font-bold focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
      <p className="text-xs text-gray-500 mt-2 m-0">El cambio con el que arrancás. Si no tenés efectivo inicial, poné 0.</p>
    </Modal>
  )
}

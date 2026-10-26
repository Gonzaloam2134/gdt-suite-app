import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

const CAMPO = 'w-full p-3 border border-gray-300 rounded-[14px] text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white'

/** Anota un consumo: pura deuda, no entra al arqueo del día. */
export default function AnotarConsumoModal({ isOpen, onClose, onGuardar, clienteNombre }) {
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cerrar = () => { setMonto(''); setDescripcion(''); onClose() }

  const guardar = async (e) => {
    e.preventDefault()
    const n = Number(monto)
    if (!n || n <= 0) return toast.error('Ingresá un monto válido')
    setGuardando(true)
    try {
      await onGuardar(n, descripcion)
      toast.success('Consumo anotado')
      cerrar()
    } catch (err) {
      toast.error(`No se pudo anotar: ${err.message}`)
    } finally { setGuardando(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Anotar consumo" subtitle={clienteNombre} size="sm">
      <form onSubmit={guardar} className="space-y-3">
        <input type="number" step="0.01" min="0" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)}
          required autoFocus placeholder="Monto" aria-label="Monto" className={CAMPO} />
        <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Qué se llevó — opcional (ej: gaseosa + alfajor)" aria-label="Descripción" className={CAMPO} />
        <p className="text-xs text-gray-400 m-0">Esto queda como deuda del cliente — no suma al arqueo de hoy.</p>
        <Button type="submit" variant="primary" disabled={guardando} className="w-full !rounded-[14px] min-h-[48px]">
          {guardando ? 'Anotando…' : 'Anotar consumo'}
        </Button>
      </form>
    </Modal>
  )
}

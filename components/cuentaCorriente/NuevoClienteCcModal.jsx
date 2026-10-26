import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

const CAMPO = 'w-full p-3 border border-gray-300 rounded-[14px] text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white'

/** Alta de un cliente con cuenta corriente (ej: un alumno del colegio). */
export default function NuevoClienteCcModal({ isOpen, onClose, onCrear }) {
  const [nombre, setNombre] = useState('')
  const [identificador, setIdentificador] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cerrar = () => { setNombre(''); setIdentificador(''); onClose() }

  const guardar = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) return toast.error('Ingresá un nombre')
    setGuardando(true)
    try {
      await onCrear(nombre, identificador)
      toast.success('Cliente agregado')
      cerrar()
    } catch (err) {
      toast.error(`No se pudo agregar: ${err.message}`)
    } finally { setGuardando(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Nuevo cliente" subtitle="Para anotar sus consumos a cuenta corriente" size="sm">
      <form onSubmit={guardar} className="space-y-3">
        <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus
          placeholder="Nombre (ej: Juan Pérez)" aria-label="Nombre" className={CAMPO} />
        <input type="text" value={identificador} onChange={(e) => setIdentificador(e.target.value)}
          placeholder="Dato para identificarlo — opcional (ej: 4to B, tel. del padre)" aria-label="Identificador" className={CAMPO} />
        <Button type="submit" variant="success" disabled={guardando} className="w-full !rounded-[14px] min-h-[48px]">
          {guardando ? 'Agregando…' : 'Agregar cliente'}
        </Button>
      </form>
    </Modal>
  )
}

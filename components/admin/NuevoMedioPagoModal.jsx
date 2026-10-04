import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { TIPOS_MEDIO, LABEL_TIPO_MEDIO, iconoMedio } from '../../lib/constants/mediosPago'

const FORM_VACIO = { nombre: '', tipo: TIPOS_MEDIO.EFECTIVO, comision: '', plazo: '' }
const CAMPO = 'w-full p-3 border border-gray-300 rounded-[14px] text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white'

/** Alta de un medio de pago, en sheet (mobile) o modal (desktop). */
export default function NuevoMedioPagoModal({ isOpen, onClose, onGuardar, procesando }) {
  const [form, setForm] = useState(FORM_VACIO)
  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))

  const cerrar = () => { setForm(FORM_VACIO); onClose() }
  const guardar = async (e) => {
    e.preventDefault()
    if (await onGuardar(form)) cerrar()
  }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Agregar medio de pago" size="sm">
      <form onSubmit={guardar} className="space-y-3">
        <input type="text" value={form.nombre} onChange={set('nombre')} required autoFocus placeholder="Nombre (ej: Mercado Pago)" aria-label="Nombre" className={CAMPO} />
        <select value={form.tipo} onChange={set('tipo')} aria-label="Tipo" className={CAMPO}>
          {Object.values(TIPOS_MEDIO).map(t => <option key={t} value={t}>{iconoMedio(t)} {LABEL_TIPO_MEDIO[t]}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" step="0.01" min="0" max="100" inputMode="decimal" value={form.comision} onChange={set('comision')} placeholder="Comisión %" aria-label="Comisión" className={CAMPO} />
          <input type="number" min="0" step="1" inputMode="numeric" value={form.plazo} onChange={set('plazo')} placeholder="Días a acreditar" aria-label="Plazo de acreditación" className={CAMPO} />
        </div>
        <Button type="submit" variant="success" disabled={procesando} className="w-full !rounded-[14px] min-h-[48px]">
          {procesando ? 'Agregando…' : 'Agregar medio de pago'}
        </Button>
      </form>
    </Modal>
  )
}

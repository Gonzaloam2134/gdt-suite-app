import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { formatCurrency } from '../../lib/format'
import { excedeSaldo } from '../../lib/domain/cuentaCorriente'

const CAMPO = 'w-full p-3 border border-gray-300 rounded-[14px] text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white'

/**
 * Registra el pago del padre: es plata real, se cobra con un medio de pago
 * normal y baja el saldo. Admite pago parcial — no obliga a saldar todo.
 */
export default function RegistrarPagoCcModal({ isOpen, onClose, onGuardar, clienteNombre, saldo, mediosPago }) {
  const [monto, setMonto] = useState('')
  const [medioPagoId, setMedioPagoId] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (isOpen) { setMonto(saldo > 0 ? String(saldo) : ''); setMedioPagoId(mediosPago?.[0]?.id || '') }
  }, [isOpen, saldo, mediosPago])

  const cerrar = () => { setMonto(''); onClose() }

  const guardar = async (e) => {
    e.preventDefault()
    const n = Number(monto)
    if (!n || n <= 0) return toast.error('Ingresá un monto válido')
    if (!medioPagoId) return toast.error('Elegí un medio de pago')
    setGuardando(true)
    try {
      await onGuardar(n, medioPagoId)
      toast.success('Pago registrado')
      cerrar()
    } catch (err) {
      toast.error(`No se pudo registrar el pago: ${err.message}`)
    } finally { setGuardando(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Registrar pago" subtitle={clienteNombre} size="sm">
      <form onSubmit={guardar} className="space-y-3">
        <div className="bg-gray-50 border border-gray-200 rounded-[14px] p-3 text-sm flex justify-between">
          <span className="text-gray-500">Saldo pendiente</span>
          <span className="font-bold">{formatCurrency(Math.max(0, saldo))}</span>
        </div>
        <input type="number" step="0.01" min="0" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)}
          required autoFocus placeholder="Monto a pagar" aria-label="Monto" className={CAMPO} />
        {excedeSaldo(monto, saldo) && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[10px] p-2 m-0">
            Este pago es mayor que la deuda — el excedente queda a favor del cliente.
          </p>
        )}
        <select value={medioPagoId} onChange={(e) => setMedioPagoId(e.target.value)} aria-label="Medio de pago" className={CAMPO}>
          <option value="" disabled>Medio de pago…</option>
          {(mediosPago || []).map(m => <option key={m.id} value={m.id}>{m.icono} {m.nombre}</option>)}
        </select>
        <p className="text-xs text-gray-400 m-0">Esto se cobra en caja como una venta normal y baja el saldo del cliente.</p>
        <Button type="submit" variant="success" disabled={guardando} className="w-full !rounded-[14px] min-h-[48px]">
          {guardando ? 'Registrando…' : 'Registrar pago'}
        </Button>
      </form>
    </Modal>
  )
}

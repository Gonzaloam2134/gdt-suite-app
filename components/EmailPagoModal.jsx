import { useState, useEffect } from 'react'
import Modal from './ui/Modal'
import { LABEL_SEGMENTO } from '../lib/constants/planes'
import { formatCurrency } from '../lib/format'

/**
 * Mercado Pago exige un email para crear la suscripción, y la persona que
 * paga tiene que estar logueada en MP con ese mismo email — no
 * necesariamente el mismo con el que se registró en GDT Suite. Antes lo
 * asumíamos en silencio (usábamos el email de la cuenta), lo que rompía sin
 * avisar si alguien paga con una cuenta de Mercado Pago distinta. Ahora se
 * pregunta acá, con el de la cuenta ya precargado como sugerencia.
 */
export default function EmailPagoModal({ isOpen, onClose, segmento, precio, ciclo, emailSugerido, onConfirmar, procesando }) {
  const [email, setEmail] = useState('')

  useEffect(() => { if (isOpen) setEmail(emailSugerido || '') }, [isOpen, emailSugerido])

  const valido = /\S+@\S+\.\S+/.test(email)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💳 Confirmar pago" size="sm"
      headerClassName="bg-blue-600 text-white"
      footer={<>
        <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Cancelar</button>
        <button onClick={() => onConfirmar(email)} disabled={!valido || procesando}
          className="px-4 py-2.5 bg-blue-600 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-700 disabled:opacity-50">
          {procesando ? 'Redirigiendo…' : 'Ir a pagar'}
        </button>
      </>}>
      <p className="text-sm text-gray-700 m-0">
        Plan <strong>{LABEL_SEGMENTO[segmento]}</strong> — {formatCurrency(precio)} /{ciclo === 'mensual' ? 'mes' : 'año'}
      </p>
      <label htmlFor="email-pago" className="block text-sm font-semibold text-gray-700 mt-4 mb-2">
        ¿Con qué email pagás en Mercado Pago?
      </label>
      <input id="email-pago" type="email" value={email} autoFocus
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@email.com"
        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
      <p className="text-xs text-gray-400 mt-2 m-0">
        Tiene que ser el email de tu cuenta de Mercado Pago — no hace falta que sea el mismo con el que entrás a GDT Suite.
      </p>
    </Modal>
  )
}

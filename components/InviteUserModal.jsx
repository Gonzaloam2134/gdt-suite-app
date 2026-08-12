import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import toast from 'react-hot-toast'

// Descripciones cortas y precisas de cada rol
const ROLES_INFO = {
  cajero: {
    titulo: 'Cajero',
    icono: '👨‍💼',
    descripcion: 'Opera la caja, registra ventas y gastos/pagos. Ve los totales del día.',
    puede: [
      'Abrir/cerrar caja',
      'Registrar ventas',
      'Registrar gastos/pagos',
      'Ver resumen diario',
      'Ver reportes'
    ],
    noPuede: [
      'Crear medios de pago',
      'Eliminar ventas registradas',
      'Invitar usuarios'
    ]
  },
  empleado: {
    titulo: 'Empleado',
    icono: '👷',
    descripcion: 'Solo registra ventas del mostrador. No ve totales ni opera la caja.',
    puede: [
      'Registrar ventas (cobros a clientes)'
    ],
    noPuede: [
      'Registrar gastos/pagos',
      'Operar caja',
      'Ver totales',
      'Ver reportes'
    ]
  }
}

export default function InviteUserModal({ isOpen, onClose, localId, userId }) {
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('cajero')
  const [loading, setLoading] = useState(false)
  const [invitedUsers, setInvitedUsers] = useState([])
  const [showRoleInfo, setShowRoleInfo] = useState(null)

  if (!isOpen) return null

  const addInvite = () => {
    if (!email || !email.includes('@')) {
      toast.error('Ingresá un email válido')
      return
    }
    
    if (invitedUsers.some(inv => inv.email === email.toLowerCase())) {
      toast.error('Este email ya fue agregado')
      return
    }

    setInvitedUsers([...invitedUsers, { email: email.toLowerCase(), rol }])
    setEmail('')
    setRol('cajero')
  }

  const removeInvite = (index) => {
    setInvitedUsers(invitedUsers.filter((_, i) => i !== index))
  }

  const handleSendInvites = async () => {
    if (invitedUsers.length === 0) {
      toast.error('Agregá al menos un usuario')
      return
    }

    try {
      setLoading(true)

      const invitaciones = invitedUsers.map(inv => ({
        email_invitado: inv.email,
        local_id: localId,
        rol: inv.rol,
        invitado_por: userId,
        token: crypto.randomUUID(),
        expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        estado: 'pendiente'
      }))

      const { error } = await supabase
        .from('invitaciones')
        .insert(invitaciones)

      if (error) throw error

      toast.success(`✅ ${invitedUsers.length} invitación(es) creada(s)`)
      
      // Mostrar los links para copiar
      invitedUsers.forEach((inv, i) => {
        const token = invitaciones[i].token
        const url = `${window.location.origin}/invitacion/${token}`
        console.log(`Link para ${inv.email}: ${url}`)
      })

      setInvitedUsers([])
      onClose()
      
    } catch (err) {
      toast.error('Error al crear invitaciones: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="m-0 text-xl font-bold text-gray-900">👥 Invitar usuarios al local</h2>
          <button onClick={onClose} className="bg-none border-none text-xl cursor-pointer text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Agregá los emails de tu equipo. Les enviaremos un link para que acepten la invitación.
        </p>

        {/* Formulario para agregar invitación */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
          <div className="mb-3">
            <label className="block mb-2 font-semibold text-gray-700 text-sm">Email del usuario</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border"
            />
          </div>

          <div className="mb-3">
            <label className="block mb-2 font-semibold text-gray-700 text-sm">Rol</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ROLES_INFO).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRol(key)}
                  className={`p-3 rounded-lg border-2 text-left cursor-pointer transition-all ${
                    rol === key 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{info.icono}</span>
                    <span className="font-bold text-sm text-gray-900">{info.titulo}</span>
                  </div>
                  <div className="text-xs text-gray-600">{info.descripcion}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={addInvite}
            className="w-full p-3 bg-emerald-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-emerald-600 transition-colors"
          >
            + Agregar a la lista
          </button>
        </div>

        {/* Info detallada de roles (expandible) */}
        <div className="space-y-2 mb-4">
          {Object.entries(ROLES_INFO).map(([key, info]) => (
            <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRoleInfo(showRoleInfo === key ? null : key)}
                className="w-full p-3 bg-white text-left cursor-pointer hover:bg-gray-50 flex justify-between items-center"
              >
                <span className="text-sm font-semibold text-gray-700">
                  {info.icono} ¿Qué puede hacer un {info.titulo.toLowerCase()}?
                </span>
                <span className="text-gray-400">{showRoleInfo === key ? '▼' : '▶'}</span>
              </button>
              {showRoleInfo === key && (
                <div className="p-3 bg-gray-50 border-t border-gray-200">
                  <div className="mb-2">
                    <div className="text-xs font-semibold text-green-700 mb-1">✅ Puede:</div>
                    <ul className="text-xs text-gray-700 space-y-1 ml-4">
                      {info.puede.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-red-700 mb-1"> No puede:</div>
                    <ul className="text-xs text-gray-700 space-y-1 ml-4">
                      {info.noPuede.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Lista de invitaciones agregadas */}
        {invitedUsers.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-4">
            <div className="text-sm font-bold text-blue-900 mb-2">
              📧 {invitedUsers.length} usuario{invitedUsers.length > 1 ? 's' : ''} para invitar:
            </div>
            <div className="space-y-2">
              {invitedUsers.map((inv, index) => (
                <div key={index} className="flex justify-between items-center bg-white p-2 rounded-md">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{ROLES_INFO[inv.rol].icono}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{inv.email}</div>
                      <div className="text-xs text-gray-500">{ROLES_INFO[inv.rol].titulo}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInvite(index)}
                    className="text-red-500 hover:text-red-700 bg-none border-none cursor-pointer text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 p-3 bg-gray-100 text-gray-700 border-none rounded-lg font-semibold cursor-pointer hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSendInvites}
            disabled={loading || invitedUsers.length === 0}
            className="flex-1 p-3 bg-blue-500 text-white border-none rounded-lg font-bold cursor-pointer hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Enviando...' : `Enviar ${invitedUsers.length} invitación(es)`}
          </button>
        </div>
      </div>
    </div>
  )
}
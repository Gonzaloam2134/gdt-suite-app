import { useState } from 'react'
import toast from 'react-hot-toast'
import { crearInvitacion, cambiarRol, quitarMiembro } from '../../lib/services/miembros'
import { actualizarPerfil } from '../../lib/services/auth'
import { registrarAccion } from '../../lib/services/auditoria'
import { ACCIONES } from '../../lib/constants/auditoria'
import { ROLES, ROLES_INVITABLES, LABEL_ROL } from '../../lib/constants/roles'
import { formatFecha } from '../../lib/format'
import EditarMiembroModal from './EditarMiembroModal'
import ConfirmDialog from '../ui/ConfirmDialog'
import EmptyState from '../ui/EmptyState'

const COLOR_ROL = { owner: 'bg-purple-100 text-purple-800', cajero: 'bg-blue-100 text-blue-800', empleado: 'bg-gray-100 text-gray-800' }
const ICONO_ROL = { owner: '👑', cajero: '💼', empleado: '👷' }

export default function MiembrosTab({ miembros, localId, userId, onCambio }) {
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState(ROLES.CAJERO)
  const [invitando, setInvitando] = useState(false)
  const [editando, setEditando] = useState(null)
  const [aQuitar, setAQuitar] = useState(null)
  const [procesando, setProcesando] = useState(false)

  const invitar = async (e) => {
    e.preventDefault()
    if (!email.trim()) return toast.error('Ingresá el email de la persona')
    setInvitando(true)
    try {
      await crearInvitacion({ localId, email, rol, invitadoPor: userId })
      await registrarAccion({ localId, userId, accion: ACCIONES.USUARIO_INVITADO, detalles: { email, rol } })
      toast.success('Invitación enviada')
      setEmail('')
      onCambio()
    } catch (err) {
      toast.error(`No se pudo invitar: ${err.message}`)
    } finally { setInvitando(false) }
  }

  const guardarEdicion = async ({ rol: nuevoRol, nombre }) => {
    setProcesando(true)
    try {
      await cambiarRol(editando.id, nuevoRol)
      if (nombre && nombre !== editando.perfil?.nombre) {
        await actualizarPerfil(editando.user_id, { nombre, email: editando.perfil?.email })
      }
      await registrarAccion({
        localId, userId, accion: ACCIONES.ROL_CAMBIADO,
        detalles: { miembro: editando.user_id, rol_anterior: editando.rol, rol_nuevo: nuevoRol },
      })
      toast.success('Miembro actualizado')
      setEditando(null)
      onCambio()
    } catch (err) {
      toast.error(`No se pudo actualizar: ${err.message}`)
    } finally { setProcesando(false) }
  }

  const confirmarQuitar = async () => {
    setProcesando(true)
    try {
      await quitarMiembro(aQuitar.id)
      await registrarAccion({ localId, userId, accion: ACCIONES.MIEMBRO_QUITADO, detalles: { miembro: aQuitar.user_id } })
      toast.success('Miembro quitado del local')
      setAQuitar(null)
      onCambio()
    } catch (err) {
      toast.error(`No se pudo quitar: ${err.message}`)
    } finally { setProcesando(false) }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={invitar} className="bg-white p-4 rounded-xl border border-gray-200">
        <h3 className="text-base font-bold text-gray-900 mb-3 m-0">Invitar a alguien al local</h3>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            placeholder="Email de la persona" aria-label="Email"
            className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <select value={rol} onChange={(e) => setRol(e.target.value)} aria-label="Rol"
            className="p-2.5 border border-gray-300 rounded-lg text-sm">
            {ROLES_INVITABLES.map(r => <option key={r} value={r}>{LABEL_ROL[r]}</option>)}
          </select>
          <button type="submit" disabled={invitando}
            className="px-5 py-2.5 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 disabled:opacity-50">
            {invitando ? 'Enviando…' : 'Invitar'}
          </button>
        </div>
      </form>

      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">Miembros ({miembros.length})</h3>
        {miembros.length === 0 ? (
          <EmptyState icono="👥" titulo="Todavía no hay miembros" descripcion="Invitá a tu cajero para que registre movimientos." />
        ) : (
          <div className="space-y-2">
            {miembros.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-gray-200 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-lg ${COLOR_ROL[m.rol]}`}>{ICONO_ROL[m.rol]}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{m.perfil?.nombre || m.perfil?.email || 'Usuario'}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {m.perfil?.email}{m.aceptado_en && ` · desde ${formatFecha(m.aceptado_en)}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${COLOR_ROL[m.rol]}`}>{LABEL_ROL[m.rol]}</span>
                  {m.rol !== ROLES.OWNER && (
                    <>
                      <button onClick={() => setEditando(m)} className="px-3 py-1 bg-amber-100 text-amber-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-amber-200">Editar</button>
                      <button onClick={() => setAQuitar(m)} className="px-3 py-1 bg-red-100 text-red-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-red-200">Quitar</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EditarMiembroModal isOpen={!!editando} onClose={() => setEditando(null)} miembro={editando}
        onGuardar={guardarEdicion} procesando={procesando} />

      <ConfirmDialog isOpen={!!aQuitar} onClose={() => setAQuitar(null)} onConfirm={confirmarQuitar} danger loading={procesando}
        title="Quitar del local"
        message={`${aQuitar?.perfil?.nombre || aQuitar?.perfil?.email || 'Esta persona'} va a perder el acceso a este local. Sus movimientos registrados se conservan.`}
        confirmLabel="Quitar" />
    </div>
  )
}

import { useState } from 'react'
import toast from 'react-hot-toast'
import { crearInvitacion, cambiarRol, quitarMiembro, reactivarMiembro, linkInvitacion, rolExistenteDe } from '../../lib/services/miembros'
import { actualizarPerfil } from '../../lib/services/auth'
import { registrarAccion } from '../../lib/services/auditoria'
import { ACCIONES } from '../../lib/constants/auditoria'
import { ROLES, ROLES_INVITABLES, LABEL_ROL } from '../../lib/constants/roles'
import { formatFecha } from '../../lib/format'
import EditarMiembroModal from './EditarMiembroModal'
import InvitacionesPendientes from './InvitacionesPendientes'
import ConfirmDialog from '../ui/ConfirmDialog'
import EmptyState from '../ui/EmptyState'
import Modal from '../ui/Modal'

const COLOR_ROL = { owner: 'bg-purple-100 text-purple-800', cajero: 'bg-blue-100 text-blue-800', empleado: 'bg-gray-100 text-gray-800' }
const ICONO_ROL = { owner: '👑', cajero: '💼', empleado: '👷' }

export default function MiembrosTab({ miembros, inactivos = [], invitaciones = [], localId, userId, onCambio }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState(ROLES.CAJERO)
  const [invitando, setInvitando] = useState(false)
  const [editando, setEditando] = useState(null)
  const [aQuitar, setAQuitar] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [recienCreada, setRecienCreada] = useState(null)
  const [verInactivos, setVerInactivos] = useState(false)
  const [rolYaAsignado, setRolYaAsignado] = useState(null)

  /**
   * Una persona tiene el mismo rol en todos sus locales. Si ya participa en otro,
   * fijamos ese rol acá para no prometer algo que la base va a rechazar.
   */
  const revisarRolExistente = async (valor) => {
    const email = valor.trim()
    if (!email.includes('@')) { setRolYaAsignado(null); return }
    try {
      const existente = await rolExistenteDe(email)
      setRolYaAsignado(existente || null)
      if (existente) setRol(existente)
    } catch { setRolYaAsignado(null) }
  }

  const invitar = async (e) => {
    e.preventDefault()
    if (!email.trim()) return toast.error('Ingresá el email de la persona')
    setInvitando(true)
    try {
      const inv = await crearInvitacion({ localId, email, nombre, rol, invitadoPor: userId })
      await registrarAccion({ localId, userId, accion: ACCIONES.USUARIO_INVITADO, detalles: { email, rol } })
      setRecienCreada(inv)
      setEmail('')
      setNombre('')
      onCambio()
    } catch (err) {
      toast.error(err.message?.includes('duplicate') || err.message?.includes('unica')
        ? 'Ya hay una invitación pendiente para ese email en este local'
        : `No se pudo invitar: ${err.message}`)
    } finally { setInvitando(false) }
  }

  const reincorporar = async (miembro) => {
    setProcesando(true)
    try {
      await reactivarMiembro(miembro.id)
      toast.success(`${miembro.perfil?.nombre || 'La persona'} vuelve a tener acceso`)
      onCambio()
    } catch (err) {
      toast.error(`No se pudo reincorporar: ${err.message}`)
    } finally { setProcesando(false) }
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
        <h3 className="text-base font-bold text-gray-900 mb-1 m-0">Sumar a alguien al local</h3>
        <p className="text-xs text-gray-500 mb-3 m-0">
          Le llega un mail, y además vas a poder copiar el link o mandárselo por WhatsApp.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_auto] gap-3">
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre (opcional)" aria-label="Nombre"
            className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <input type="email" value={email} required
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => revisarRolExistente(e.target.value)}
            placeholder="Email de la persona" aria-label="Email"
            className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <select value={rol} onChange={(e) => setRol(e.target.value)} aria-label="Rol"
            disabled={!!rolYaAsignado}
            className="p-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-500">
            {ROLES_INVITABLES.map(r => <option key={r} value={r}>{LABEL_ROL[r]}</option>)}
          </select>
          <button type="submit" disabled={invitando}
            className="px-5 py-2.5 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 disabled:opacity-50">
            {invitando ? 'Creando…' : 'Sumar'}
          </button>
        </div>
        {rolYaAsignado && (
          <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-2 mt-3 m-0">
            Esta persona ya trabaja en otro de tus locales como <strong>{LABEL_ROL[rolYaAsignado]}</strong>.
            Cada persona tiene el mismo rol en todos los locales, así que entra con ese.
          </p>
        )}
      </form>

      <InvitacionesPendientes invitaciones={invitaciones} onCambio={onCambio} />

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

      {inactivos.length > 0 && (
        <div>
          <button onClick={() => setVerInactivos(v => !v)} aria-expanded={verInactivos}
            className="text-xs font-semibold text-gray-600 bg-transparent border-none cursor-pointer hover:underline p-0">
            {verInactivos ? '▲ Ocultar' : '▼ Ver'} personas que sacaste del local ({inactivos.length})
          </button>
          {verInactivos && (
            <div className="space-y-2 mt-2">
              {inactivos.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-700 text-sm truncate">{m.perfil?.nombre || m.perfil?.email || 'Usuario'}</div>
                    <div className="text-xs text-gray-500 truncate">{m.perfil?.email} · era {LABEL_ROL[m.rol]}</div>
                  </div>
                  <button onClick={() => reincorporar(m)} disabled={procesando}
                    className="px-3 py-1 bg-green-100 text-green-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-green-200 disabled:opacity-50 shrink-0">
                    Reincorporar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={!!recienCreada} onClose={() => setRecienCreada(null)} title="Listo, ya podés mandarle el acceso"
        subtitle={recienCreada?.email_invitado} size="md"
        footer={<button onClick={() => setRecienCreada(null)}
          className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Listo</button>}>
        <p className="text-sm text-gray-600 m-0">
          Le enviamos un mail, pero si no lo usa mandale este link directo. Vence en 7 días.
        </p>
        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 break-all font-mono">
          {recienCreada && linkInvitacion(recienCreada.token)}
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <button onClick={() => {
              const t = `Hola${recienCreada.nombre_invitado ? ` ${recienCreada.nombre_invitado}` : ''}! Te invito a sumarte como ${LABEL_ROL[recienCreada.rol]}. Entrá acá: ${linkInvitacion(recienCreada.token)}`
              window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener')
            }}
            className="px-4 py-2.5 bg-green-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-green-600">
            Enviar por WhatsApp
          </button>
          <button onClick={async () => {
              try { await navigator.clipboard.writeText(linkInvitacion(recienCreada.token)); toast.success('Link copiado') }
              catch { toast.error('Copialo a mano desde el recuadro') }
            }}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">
            Copiar link
          </button>
        </div>
      </Modal>

      <EditarMiembroModal isOpen={!!editando} onClose={() => setEditando(null)} miembro={editando}
        onGuardar={guardarEdicion} procesando={procesando} />

      <ConfirmDialog isOpen={!!aQuitar} onClose={() => setAQuitar(null)} onConfirm={confirmarQuitar} danger loading={procesando}
        title="Quitar del local"
        message={`${aQuitar?.perfil?.nombre || aQuitar?.perfil?.email || 'Esta persona'} va a perder el acceso a este local. Sus movimientos registrados se conservan.`}
        confirmLabel="Quitar" />
    </div>
  )
}

import { useState } from 'react'
import toast from 'react-hot-toast'
import { cambiarRol, quitarMiembro, reactivarMiembro } from '../../lib/services/miembros'
import { actualizarPerfil } from '../../lib/services/auth'
import { registrarAccion } from '../../lib/services/auditoria'
import { ACCIONES } from '../../lib/constants/auditoria'
import { ROLES, LABEL_ROL } from '../../lib/constants/roles'
import { superaLimiteEquipo } from '../../lib/domain/planes'
import { invitacionVigente } from '../../lib/domain/invitaciones'
import { formatFecha } from '../../lib/format'
import EditarMiembroModal from './EditarMiembroModal'
import SumarPersonaModal from './SumarPersonaModal'
import InvitacionesPendientes from './InvitacionesPendientes'
import ConfirmDialog from '../ui/ConfirmDialog'
import EmptyState from '../ui/EmptyState'
import Button from '../ui/Button'

const COLOR_ROL = { owner: 'bg-purple-100 text-purple-800', cajero: 'bg-blue-100 text-blue-800', empleado: 'bg-gray-100 text-gray-800' }
const ICONO_ROL = { owner: '👑', cajero: '💼', empleado: '👷' }

export default function MiembrosTab({ miembros, inactivos = [], invitaciones = [], suscripcion, localId, userId, onCambio }) {
  const [sumando, setSumando] = useState(false)
  const [editando, setEditando] = useState(null)
  const [aQuitar, setAQuitar] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [verInactivos, setVerInactivos] = useState(false)

  // Durante la prueba gratuita no hay segmento todavía: no se limita nada.
  // El límite solo aplica una vez que el local está en un plan pago.
  const segmento = suscripcion?.plan === 'pago' ? suscripcion.segmento : null
  const personasActivas = miembros.length + invitaciones.filter(invitacionVigente).length
  const sinCupo = segmento && superaLimiteEquipo(segmento, personasActivas)

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-500 m-0">
          Sumá a quien trabaje con vos. Le mandás un link por WhatsApp y entra con su propia cuenta.
        </p>
        <Button variant="primary" onClick={() => setSumando(true)}>+ Sumar persona</Button>
      </div>

      <InvitacionesPendientes invitaciones={invitaciones} onCambio={onCambio} />

      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">Equipo ({miembros.length})</h3>
        {miembros.length === 0 ? (
          <EmptyState icono="👥" titulo="Todavía no hay nadie en el equipo" descripcion="Sumá a tu cajero para que registre movimientos."
            accion={<Button variant="primary" onClick={() => setSumando(true)}>+ Sumar persona</Button>} />
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
                      <Button variant="ghost" size="sm" onClick={() => setEditando(m)}>Editar</Button>
                      <Button variant="danger" size="sm" onClick={() => setAQuitar(m)}>Quitar</Button>
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
                  <Button variant="success" size="sm" onClick={() => reincorporar(m)} disabled={procesando}>
                    Reincorporar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SumarPersonaModal isOpen={sumando} onClose={() => setSumando(false)}
        localId={localId} userId={userId} segmento={segmento} sinCupo={sinCupo} onCambio={onCambio} />

      <EditarMiembroModal isOpen={!!editando} onClose={() => setEditando(null)} miembro={editando}
        onGuardar={guardarEdicion} procesando={procesando} />

      <ConfirmDialog isOpen={!!aQuitar} onClose={() => setAQuitar(null)} onConfirm={confirmarQuitar} danger loading={procesando}
        title="Quitar del local"
        message={`${aQuitar?.perfil?.nombre || aQuitar?.perfil?.email || 'Esta persona'} va a perder el acceso a este local. Sus movimientos registrados se conservan.`}
        confirmLabel="Quitar" />
    </div>
  )
}

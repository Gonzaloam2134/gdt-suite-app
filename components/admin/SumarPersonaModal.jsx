import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { crearInvitacion, rolExistenteDe, linkInvitacion } from '../../lib/services/miembros'
import { registrarAccion } from '../../lib/services/auditoria'
import { ACCIONES } from '../../lib/constants/auditoria'
import { ROLES, ROLES_INVITABLES, LABEL_ROL } from '../../lib/constants/roles'
import { LABEL_SEGMENTO } from '../../lib/constants/planes'
import { mensajeError } from '../../lib/errorMessage'

const ESTADO_INICIAL = { nombre: '', email: '', rol: ROLES.CAJERO, rolYaAsignado: null }

/**
 * Un solo modal con dos vistas: 'form' (alta) → 'confirmacion' (link listo
 * para mandar). Mismo modal, no dos componentes — así no hay que coordinar
 * el cierre de uno con la apertura del otro.
 */
export default function SumarPersonaModal({ isOpen, onClose, localId, userId, segmento, sinCupo, onCambio }) {
  const [vista, setVista] = useState('form')
  const [datos, setDatos] = useState(ESTADO_INICIAL)
  const [invitando, setInvitando] = useState(false)
  const [creada, setCreada] = useState(null)

  const reiniciar = () => { setVista('form'); setDatos(ESTADO_INICIAL); setCreada(null) }
  const cerrar = () => { reiniciar(); onClose() }

  const revisarRolExistente = async (valor) => {
    const email = valor.trim()
    if (!email.includes('@')) { setDatos(d => ({ ...d, rolYaAsignado: null })); return }
    try {
      const existente = await rolExistenteDe(email)
      setDatos(d => ({ ...d, rolYaAsignado: existente || null, rol: existente || d.rol }))
    } catch { setDatos(d => ({ ...d, rolYaAsignado: null })) }
  }

  const invitar = async (e) => {
    e.preventDefault()
    if (!datos.email.trim()) return toast.error('Ingresá el email de la persona')
    if (sinCupo) return toast.error(`Tu plan ${LABEL_SEGMENTO[segmento]} permite solo al dueño operando. Actualizá a Negocio para sumar gente.`)
    setInvitando(true)
    try {
      const inv = await crearInvitacion({ localId, email: datos.email, nombre: datos.nombre, rol: datos.rol })
      await registrarAccion({ localId, userId, accion: ACCIONES.USUARIO_INVITADO, detalles: { email: datos.email, rol: datos.rol } })
      setCreada(inv)
      setVista('confirmacion')
      onCambio()
    } catch (err) {
      toast.error(mensajeError(err))
    } finally { setInvitando(false) }
  }

  if (vista === 'confirmacion' && creada) {
    return (
      <Modal isOpen={isOpen} onClose={cerrar} title="Listo, ya podés mandarle el acceso" subtitle={creada.email_invitado} size="md"
        footer={<Button variant="secondary" onClick={cerrar}>Listo</Button>}>
        <p className="text-sm text-gray-600 m-0">
          Mandale este link para que pueda crear su cuenta. Vence en 7 días.
        </p>
        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 break-all font-mono">
          {linkInvitacion(creada.token)}
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Button variant="success" onClick={() => {
            const t = `Hola${creada.nombre_invitado ? ` ${creada.nombre_invitado}` : ''}! Te invito a sumarte como ${LABEL_ROL[creada.rol]}. Entrá acá: ${linkInvitacion(creada.token)}`
            window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener')
          }}>
            Enviar por WhatsApp
          </Button>
          <Button variant="secondary" onClick={async () => {
            try { await navigator.clipboard.writeText(linkInvitacion(creada.token)); toast.success('Link copiado') }
            catch { toast.error('Copialo a mano desde el recuadro') }
          }}>
            Copiar link
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Sumar persona" subtitle="Se genera un link de acceso que le mandás por WhatsApp o le copiás. Vence en 7 días." size="md"
      footer={<>
        <Button variant="secondary" onClick={cerrar}>Cancelar</Button>
        <Button variant="primary" onClick={invitar} disabled={invitando || sinCupo} title={sinCupo ? 'Llegaste al límite de tu plan' : ''}>
          {invitando ? 'Creando…' : 'Sumar'}
        </Button>
      </>}>
      <form onSubmit={invitar} className="space-y-3">
        {sinCupo && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-semibold text-amber-900 m-0">
              Tu plan {LABEL_SEGMENTO[segmento]} llegó al límite de personas operando.
            </p>
            <p className="text-xs text-amber-800 mt-1 m-0">
              Para sumar más gente, <a href="/planes" className="font-semibold underline">actualizá a un plan sin límite de equipo</a>.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="sp-nombre" className="block text-sm font-semibold text-gray-700 mb-1">Nombre (opcional)</label>
          <input id="sp-nombre" type="text" value={datos.nombre} onChange={(e) => setDatos(d => ({ ...d, nombre: e.target.value }))}
            placeholder="María"
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <div>
          <label htmlFor="sp-email" className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
          <input id="sp-email" type="email" value={datos.email} required
            onChange={(e) => setDatos(d => ({ ...d, email: e.target.value }))}
            onBlur={(e) => revisarRolExistente(e.target.value)}
            placeholder="maria@gmail.com"
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <div>
          <label htmlFor="sp-rol" className="block text-sm font-semibold text-gray-700 mb-1">¿Qué va a poder hacer?</label>
          <select id="sp-rol" value={datos.rol} onChange={(e) => setDatos(d => ({ ...d, rol: e.target.value }))}
            disabled={!!datos.rolYaAsignado}
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-500">
            {ROLES_INVITABLES.map(r => <option key={r} value={r}>{LABEL_ROL[r]}</option>)}
          </select>
        </div>

        {datos.rolYaAsignado && (
          <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-2 m-0">
            Esta persona ya trabaja en otro de tus locales como <strong>{LABEL_ROL[datos.rolYaAsignado]}</strong>.
            Cada persona tiene el mismo rol en todos los locales, así que entra con ese.
          </p>
        )}
      </form>
    </Modal>
  )
}

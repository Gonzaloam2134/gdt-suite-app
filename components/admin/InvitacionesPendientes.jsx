import { useState } from 'react'
import toast from 'react-hot-toast'
import { linkInvitacion, renovarInvitacion, revocarInvitacion } from '../../lib/services/miembros'
import { LABEL_ROL } from '../../lib/constants/roles'
import { formatFecha } from '../../lib/format'

const copiar = async (texto) => {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // Safari en iOS puede bloquear el portapapeles: recurrimos al método viejo
    const input = document.createElement('textarea')
    input.value = texto
    document.body.appendChild(input)
    input.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(input)
    return ok
  }
}

/**
 * Invitaciones que todavía no se aceptaron, con el link listo para mandar por WhatsApp.
 * El mail puede no llegar (spam, casillas que nadie mira); el link por mensaje sí.
 */
export default function InvitacionesPendientes({ invitaciones, onCambio }) {
  const [ocupado, setOcupado] = useState(null)
  const pendientes = invitaciones.filter(i => i.estado === 'pendiente')
  if (pendientes.length === 0) return null

  const copiarLink = async (inv) => {
    const ok = await copiar(linkInvitacion(inv.token))
    ok ? toast.success('Link copiado') : toast.error('No se pudo copiar. Mantené presionado para copiarlo a mano.')
  }

  const enviarWhatsApp = (inv) => {
    const texto = `Hola${inv.nombre_invitado ? ` ${inv.nombre_invitado}` : ''}! Te invito a sumarte como ${LABEL_ROL[inv.rol] || inv.rol}. Entrá acá: ${linkInvitacion(inv.token)}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
  }

  const renovar = async (inv) => {
    setOcupado(inv.id)
    try {
      await renovarInvitacion(inv.id)
      toast.success('Link renovado por 7 días más')
      onCambio()
    } catch (err) { toast.error(`No se pudo renovar: ${err.message}`) }
    finally { setOcupado(null) }
  }

  const revocar = async (inv) => {
    setOcupado(inv.id)
    try {
      await revocarInvitacion(inv.id)
      toast.success('Invitación cancelada')
      onCambio()
    } catch (err) { toast.error(`No se pudo cancelar: ${err.message}`) }
    finally { setOcupado(null) }
  }

  return (
    <div>
      <h3 className="text-sm font-bold text-gray-700 mb-3">Invitaciones pendientes ({pendientes.length})</h3>
      <div className="space-y-2">
        {pendientes.map(inv => {
          const vencida = new Date(inv.expira_en) < new Date()
          return (
            <div key={inv.id} className="p-3 bg-white rounded-lg border border-gray-200">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 text-sm truncate">
                    {inv.nombre_invitado || inv.email_invitado}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {inv.nombre_invitado && `${inv.email_invitado} · `}
                    {LABEL_ROL[inv.rol] || inv.rol}
                    {vencida
                      ? <span className="text-red-600 font-semibold"> · vencida</span>
                      : ` · vence el ${formatFecha(inv.expira_en)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {vencida ? (
                    <button onClick={() => renovar(inv)} disabled={ocupado === inv.id}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-blue-200 disabled:opacity-50">
                      Renovar link
                    </button>
                  ) : (
                    <>
                      <button onClick={() => enviarWhatsApp(inv)}
                        className="px-3 py-1.5 bg-green-100 text-green-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-green-200">
                        Enviar por WhatsApp
                      </button>
                      <button onClick={() => copiarLink(inv)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-gray-200">
                        Copiar link
                      </button>
                    </>
                  )}
                  <button onClick={() => revocar(inv)} disabled={ocupado === inv.id}
                    className="px-3 py-1.5 bg-red-50 text-red-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-red-100 disabled:opacity-50">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

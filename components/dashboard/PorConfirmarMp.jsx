import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { usePendientesDeLocal } from '../../hooks/usePendientesMp'
import { getMapeoDeLocal } from '../../lib/services/mapeoLocalesMp'
import ConfirmarPendienteMpModal from './ConfirmarPendienteMpModal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { formatCurrency, formatFecha } from '../../lib/format'
import { mensajeError } from '../../lib/errorMessage'

const LABEL_ORIGEN = { qr: '📱 QR', point: '💳 Point', transferencia: '🏦 Transferencia' }

/**
 * "Por confirmar": cobros de Mercado Pago que llegaron por webhook/conciliación
 * pero todavía no son una venta real en la caja — nada de esto suma a los
 * totales del día hasta que alguien lo confirma acá con un toque.
 *
 * El botón "Sincronizar" no depende del cron diario (ver pages/api/cron/
 * mercadopago-cliente-sync.js) — cualquiera de la caja lo puede tocar para
 * traer transferencias u órdenes que todavía no llegaron.
 */
export default function PorConfirmarMp({ localId, local }) {
  const { pendientes, loading, confirmar, descartar, sincronizar, sincronizando } = usePendientesDeLocal(localId)
  const [aConfirmar, setAConfirmar] = useState(null)
  const [aDescartar, setADescartar] = useState(null)
  const [descartando, setDescartando] = useState(false)
  const [mpVinculado, setMpVinculado] = useState(false)

  useEffect(() => {
    if (!localId) return
    getMapeoDeLocal(localId).then((m) => setMpVinculado(!!m)).catch(() => setMpVinculado(false))
  }, [localId])

  if (loading || (pendientes.length === 0 && !mpVinculado)) return null

  const confirmarDescartar = async () => {
    setDescartando(true)
    try {
      await descartar(aDescartar.id)
      toast.success('Descartado')
      setADescartar(null)
    } catch (err) {
      toast.error(`No se pudo descartar: ${mensajeError(err)}`)
    } finally {
      setDescartando(false)
    }
  }

  const tocarSincronizar = async () => {
    try {
      const r = await sincronizar()
      const total = (r?.orders ?? 0) + (r?.transferencias ?? 0)
      toast.success(total > 0 ? `Se encontraron ${total} cobro${total === 1 ? '' : 's'} nuevo${total === 1 ? '' : 's'}` : 'Ya está todo al día')
    } catch (err) {
      toast.error(err.reintentarEnSegundos ? `Esperá ${err.reintentarEnSegundos}s para volver a sincronizar` : mensajeError(err))
    }
  }

  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
      <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-amber-900 m-0">🔔 Por confirmar {pendientes.length > 0 ? `(${pendientes.length})` : ''}</h3>
          <p className="text-xs text-amber-700 m-0">Cobros de Mercado Pago que todavía no entraron a la caja.</p>
        </div>
        <button onClick={tocarSincronizar} disabled={sincronizando}
          className="shrink-0 px-2.5 py-1.5 bg-white text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold cursor-pointer hover:bg-amber-100 disabled:opacity-50">
          {sincronizando ? 'Sincronizando…' : '↻ Sincronizar'}
        </button>
      </div>
      {pendientes.length === 0 ? (
        <p className="text-xs text-gray-500 m-0 p-3">No hay cobros pendientes de confirmar.</p>
      ) : (
      <ul className="divide-y divide-gray-100 m-0 p-0 list-none">
        {pendientes.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">{formatCurrency(Number(p.monto))}</div>
              <div className="text-xs text-gray-500 truncate">
                {LABEL_ORIGEN[p.origen] || p.origen} · {formatFecha(p.fecha_mp)}
                {p.descripcion ? ` · ${p.descripcion}` : ''}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setADescartar(p)}
                className="px-2.5 py-1.5 bg-white text-gray-500 border border-gray-200 rounded-lg text-xs font-semibold cursor-pointer hover:bg-gray-50">
                Descartar
              </button>
              <button onClick={() => setAConfirmar(p)}
                className="px-2.5 py-1.5 bg-green-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-green-600">
                Confirmar
              </button>
            </div>
          </li>
        ))}
      </ul>
      )}

      <ConfirmarPendienteMpModal
        pendiente={aConfirmar} localId={localId} local={local}
        isOpen={!!aConfirmar} onClose={() => setAConfirmar(null)}
        onConfirmar={confirmar}
      />
      <ConfirmDialog isOpen={!!aDescartar} onClose={() => setADescartar(null)} onConfirm={confirmarDescartar}
        danger title="Descartar cobro"
        message="Esto no crea ningún movimiento en la caja — usalo solo si este cobro no corresponde a una venta real."
        confirmLabel={descartando ? 'Descartando…' : 'Sí, descartar'} />
    </div>
  )
}

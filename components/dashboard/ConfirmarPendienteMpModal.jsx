import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import { listarMediosPago } from '../../lib/services/mediosPago'
import { ALICUOTAS_IVA, TIPOS_COMPROBANTE, COMPROBANTE_POR_CONDICION, discriminaIva } from '../../lib/constants/transacciones'
import { iconoMedio } from '../../lib/constants/mediosPago'
import { formatCurrency, formatFecha } from '../../lib/format'
import { mensajeError } from '../../lib/errorMessage'

const LABEL_ORIGEN = { qr: 'QR', point: 'Point', transferencia: 'Transferencia' }

/**
 * Confirmar un cobro de Mercado Pago que ya está en la cola: el monto viene
 * de MP (no se edita — "los reportes no inventan datos"), el dueño solo
 * elige a qué medio de pago del local corresponde, para que la comisión/IVA/
 * fecha de acreditación se calculen con los datos reales de ESE medio.
 */
export default function ConfirmarPendienteMpModal({ pendiente, localId, local, isOpen, onClose, onConfirmar }) {
  const [medios, setMedios] = useState([])
  const [medioId, setMedioId] = useState('')
  const [comprobante, setComprobante] = useState('SIN_COMPROBANTE')
  const [alicuota, setAlicuota] = useState(21)
  const [guardando, setGuardando] = useState(false)

  const conIva = discriminaIva(local?.condicion_fiscal)

  useEffect(() => {
    if (!isOpen || !localId) return
    listarMediosPago(localId, { soloHabilitados: true })
      .then((data) => {
        setMedios(data)
        // Sugerencia razonable: un medio de tipo qr/billetera si hay uno — el dueño puede elegir otro igual.
        const sugerido = data.find((m) => m.tipo === 'qr' || m.tipo === 'billetera_virtual') || data[0]
        if (sugerido) setMedioId(sugerido.id)
      })
      .catch(() => toast.error('No se pudieron cargar los medios de pago'))
    setComprobante(COMPROBANTE_POR_CONDICION[local?.condicion_fiscal] || 'SIN_COMPROBANTE')
    setAlicuota(conIva ? 21 : 0)
  }, [isOpen, localId, local?.condicion_fiscal, conIva])

  const medio = medios.find((m) => m.id === medioId)

  const confirmar = async () => {
    if (!medioId) return toast.error('Elegí con qué medio de pago corresponde')
    setGuardando(true)
    try {
      await onConfirmar(pendiente, { medio, alicuota: conIva ? alicuota : 0, tipoComprobante: comprobante })
      toast.success('Cobro confirmado')
      onClose()
    } catch (err) {
      toast.error(`No se pudo confirmar: ${mensajeError(err)}`)
    } finally {
      setGuardando(false)
    }
  }

  if (!pendiente) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar cobro de Mercado Pago"
      headerClassName="bg-green-600 text-white"
      footer={<>
        <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Cancelar</button>
        <button onClick={confirmar} disabled={guardando}
          className="px-4 py-2.5 bg-green-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-green-600 disabled:opacity-50">
          {guardando ? 'Confirmando…' : 'Confirmar cobro'}
        </button>
      </>}>
      <div className="space-y-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Monto</span>
            <span className="font-bold text-gray-900">{formatCurrency(Number(pendiente.monto))}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Origen</span>
            <span className="font-semibold">{LABEL_ORIGEN[pendiente.origen] || pendiente.origen}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Fecha</span>
            <span className="font-semibold">{formatFecha(pendiente.fecha_mp)}</span></div>
          {pendiente.descripcion && <p className="text-xs text-gray-500 m-0 pt-1">{pendiente.descripcion}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">¿A qué medio de pago corresponde?</label>
          <div className="grid grid-cols-2 gap-2">
            {medios.map((m) => (
              <button key={m.id} type="button" onClick={() => setMedioId(m.id)} aria-pressed={medioId === m.id}
                className={`p-2.5 rounded-lg border-2 text-sm text-left cursor-pointer transition-colors ${
                  medioId === m.id ? 'border-blue-500 bg-blue-50 font-semibold' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <span className="mr-1">{m.icono || iconoMedio(m.tipo)}</span>{m.nombre}
              </button>
            ))}
          </div>
          {medios.length === 0 && <p className="text-xs text-gray-500 m-0">No hay medios de pago configurados para este local.</p>}
        </div>

        <details className="border border-gray-200 rounded-lg">
          <summary className="p-3 text-sm font-semibold text-gray-700 cursor-pointer">Datos para el contador</summary>
          <div className="p-3 pt-0 space-y-3">
            <div>
              <label htmlFor="mp-comprobante" className="block text-xs font-semibold text-gray-600 mb-1">Comprobante</label>
              <select id="mp-comprobante" value={comprobante} onChange={(e) => setComprobante(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                {TIPOS_COMPROBANTE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {conIva && (
              <div>
                <label htmlFor="mp-alicuota" className="block text-xs font-semibold text-gray-600 mb-1">IVA</label>
                <select id="mp-alicuota" value={alicuota} onChange={(e) => setAlicuota(parseFloat(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                  {ALICUOTAS_IVA.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            )}
          </div>
        </details>
      </div>
    </Modal>
  )
}

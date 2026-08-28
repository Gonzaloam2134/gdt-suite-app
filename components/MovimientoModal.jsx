import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import Modal from './ui/Modal'
import { listarMediosPago } from '../lib/services/mediosPago'
import { registrarCobro, registrarGasto } from '../lib/services/transacciones'
import { registrarAccion } from '../lib/services/auditoria'
import { ACCIONES } from '../lib/constants/auditoria'
import { ALICUOTAS_IVA, TIPOS_COMPROBANTE, COMPROBANTE_POR_CONDICION, discriminaIva } from '../lib/constants/transacciones'
import { calcularIva, calcularComision } from '../lib/domain/transacciones'
import { formatCurrency } from '../lib/format'
import { iconoMedio } from '../lib/constants/mediosPago'
import { mensajeError } from '../lib/errorMessage'

const CONFIG = {
  cobro: { titulo: '💵 Registrar cobro', header: 'bg-green-600 text-white', boton: 'bg-green-500 hover:bg-green-600',
           accion: ACCIONES.COBRO_REGISTRADO, servicio: registrarCobro, etiquetaMedio: 'Cómo te pagaron' },
  gasto: { titulo: '💸 Registrar gasto', header: 'bg-red-600 text-white', boton: 'bg-red-500 hover:bg-red-600',
           accion: ACCIONES.GASTO_REGISTRADO, servicio: registrarGasto, etiquetaMedio: 'Cómo lo pagaste' },
}

/**
 * Un solo modal para cobros y gastos: la diferencia es el tipo, el color y el servicio.
 * Persiste alícuota y comprobante para que los reportes al contador sean reales.
 */
export default function MovimientoModal({ tipo, isOpen, onClose, localId, userId, local, onSuccess }) {
  const cfg = CONFIG[tipo]
  const [medios, setMedios] = useState([])
  const [medioId, setMedioId] = useState('')
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [alicuota, setAlicuota] = useState(21)
  const [comprobante, setComprobante] = useState('SIN_COMPROBANTE')
  const [guardando, setGuardando] = useState(false)

  const conIva = discriminaIva(local?.condicion_fiscal)

  useEffect(() => {
    if (!isOpen || !localId) return
    listarMediosPago(localId, { soloHabilitados: true })
      .then((data) => {
        setMedios(data)
        if (data.length) setMedioId(data[0].id)
      })
      .catch(() => toast.error('No se pudieron cargar los medios de pago'))
    setComprobante(COMPROBANTE_POR_CONDICION[local?.condicion_fiscal] || 'SIN_COMPROBANTE')
    setAlicuota(conIva ? 21 : 0)
  }, [isOpen, localId, local?.condicion_fiscal, conIva])

  const MONTO_MAXIMO = 99999999.99 // límite razonable para no persistir errores de tipeo (ej: notación científica)

  const medio = useMemo(() => medios.find(m => m.id === medioId), [medios, medioId])
  const montoNum = Number.isFinite(parseFloat(monto)) ? parseFloat(monto) : 0
  const previa = useMemo(() => {
    if (!montoNum) return null
    const { neto, iva } = calcularIva(montoNum, conIva ? alicuota : 0)
    const comision = tipo === 'cobro' ? calcularComision(montoNum, medio?.comision_porcentaje) : 0
    return { neto, iva, comision, acredita: montoNum - comision }
  }, [montoNum, alicuota, medio, tipo, conIva])

  const limpiar = () => { setMonto(''); setDescripcion(''); setGuardando(false) }
  const cerrar = () => { limpiar(); onClose() }

  const guardar = async (e) => {
    e?.preventDefault()
    if (!medioId) return toast.error(`Elegí ${cfg.etiquetaMedio.toLowerCase()}`)
    if (!Number.isFinite(montoNum) || montoNum <= 0) return toast.error('Ingresá un monto mayor a cero')
    if (montoNum > MONTO_MAXIMO) return toast.error(`El monto no puede superar ${formatCurrency(MONTO_MAXIMO)}`)

    setGuardando(true)
    try {
      const tx = await cfg.servicio({
        localId, medio, monto: montoNum, descripcion,
        alicuota: conIva ? alicuota : 0,
        tipoComprobante: comprobante,
      })
      await registrarAccion({
        localId, userId, accion: cfg.accion, tabla: 'transacciones', registroId: tx.id,
        detalles: { monto: montoNum, medio: medio?.nombre, descripcion },
      })
      toast.success(tipo === 'cobro' ? 'Cobro registrado' : 'Gasto registrado')
      onSuccess?.()
      cerrar()
    } catch (err) {
      toast.error(`No se pudo guardar: ${mensajeError(err)}`)
      setGuardando(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title={cfg.titulo} headerClassName={cfg.header}
      footer={<>
        <button onClick={cerrar} className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Cancelar</button>
        <button onClick={guardar} disabled={guardando} className={`px-4 py-2.5 text-white border-none rounded-lg text-sm font-bold cursor-pointer disabled:opacity-50 ${cfg.boton}`}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </>}>
      <form onSubmit={guardar} className="space-y-4">
        <div>
          <label htmlFor="mov-monto" className="block text-sm font-semibold text-gray-700 mb-2">Monto</label>
          <input id="mov-monto" type="number" step="0.01" min="0" inputMode="decimal" value={monto} autoFocus required
            onChange={(e) => setMonto(e.target.value)} placeholder="0,00"
            className="w-full p-3 border border-gray-300 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{cfg.etiquetaMedio}</label>
          <div className="grid grid-cols-2 gap-2">
            {medios.map((m) => (
              <button key={m.id} type="button" onClick={() => setMedioId(m.id)} aria-pressed={medioId === m.id}
                className={`p-2.5 rounded-lg border-2 text-sm text-left cursor-pointer transition-colors ${
                  medioId === m.id ? 'border-blue-500 bg-blue-50 font-semibold' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <span className="mr-1">{m.icono || iconoMedio(m.tipo)}</span>{m.nombre}
                {m.comision_porcentaje > 0 && <div className="text-xs text-gray-500 font-normal">{m.comision_porcentaje}% comisión</div>}
              </button>
            ))}
          </div>
          {medios.length === 0 && <p className="text-xs text-gray-500 m-0">No hay medios de pago configurados para este local.</p>}
        </div>

        <div>
          <label htmlFor="mov-desc" className="block text-sm font-semibold text-gray-700 mb-2">
            {tipo === 'cobro' ? 'Descripción (opcional)' : 'Proveedor o concepto'}
          </label>
          <input id="mov-desc" type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            placeholder={tipo === 'cobro' ? 'Ej: venta mostrador' : 'Ej: verdulería, luz, insumos'}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <details className="border border-gray-200 rounded-lg">
          <summary className="p-3 text-sm font-semibold text-gray-700 cursor-pointer">Datos para el contador</summary>
          <div className="p-3 pt-0 space-y-3">
            <div>
              <label htmlFor="mov-comprobante" className="block text-xs font-semibold text-gray-600 mb-1">Comprobante</label>
              <select id="mov-comprobante" value={comprobante} onChange={(e) => setComprobante(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                {TIPOS_COMPROBANTE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {conIva && (
              <div>
                <label htmlFor="mov-alicuota" className="block text-xs font-semibold text-gray-600 mb-1">IVA</label>
                <select id="mov-alicuota" value={alicuota} onChange={(e) => setAlicuota(parseFloat(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                  {ALICUOTAS_IVA.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            )}
          </div>
        </details>

        {previa && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-1">
            {conIva && alicuota > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Neto / IVA</span>
                <span className="font-semibold">{formatCurrency(previa.neto)} + {formatCurrency(previa.iva)}</span></div>
            )}
            {tipo === 'cobro' && previa.comision > 0 && (
              <>
                <div className="flex justify-between"><span className="text-gray-500">Comisión</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(previa.comision)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Te acreditan</span>
                  <span className="font-bold text-green-700">{formatCurrency(previa.acredita)}</span></div>
              </>
            )}
            {tipo === 'cobro' && medio?.plazo_acreditacion_dias > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Acredita en</span>
                <span className="font-semibold">{medio.plazo_acreditacion_dias} días</span></div>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}

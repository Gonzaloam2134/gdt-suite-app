import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { useUserRole } from '../lib/UserRoleContext'
import { usePreferencia } from '../hooks/usePreferencia'
import { ROLES_OPERAN_CAJA } from '../lib/constants/roles'
import { listarMediosPago } from '../lib/services/mediosPago'
import { registrarCobro, registrarGasto } from '../lib/services/transacciones'
import { registrarAccion } from '../lib/services/auditoria'
import { ACCIONES } from '../lib/constants/auditoria'
import { ALICUOTAS_IVA, TIPOS_COMPROBANTE, COMPROBANTE_POR_CONDICION, discriminaIva } from '../lib/constants/transacciones'
import { calcularIva, calcularComision } from '../lib/domain/transacciones'
import { subirComprobante } from '../lib/services/comprobantes'
import { validarComprobante } from '../lib/domain/comprobantes'
import { formatCurrency } from '../lib/format'
import { iconoMedio } from '../lib/constants/mediosPago'
import { mensajeError } from '../lib/errorMessage'

const CONFIG = {
  cobro: { titulo: 'Cobrar', variante: 'success', textoBoton: 'Cobrar',
           accion: ACCIONES.COBRO_REGISTRADO, servicio: registrarCobro, etiquetaMedio: 'Cómo te pagaron' },
  gasto: { titulo: 'Registrar gasto', variante: 'danger', textoBoton: 'Guardar gasto',
           accion: ACCIONES.GASTO_REGISTRADO, servicio: registrarGasto, etiquetaMedio: 'Cómo lo pagaste' },
}

/**
 * Un solo modal para cobros y gastos: la diferencia es el tipo, el color y el servicio.
 * Persiste alícuota y comprobante para que los reportes al contador sean reales.
 */
export default function MovimientoModal({ tipo, isOpen, onClose, localId, userId, local, onSuccess }) {
  const cfg = CONFIG[tipo]
  const { hasRole } = useUserRole()
  // Quien solo cobra (empleado) registra el hecho y nada más: la comisión, el IVA y
  // los datos para el contador se calculan solos, con los valores por defecto del local.
  const verTecnico = hasRole(ROLES_OPERAN_CAJA)
  // GDT recuerda con qué medio se cobró la última vez (por local y tipo): lo más
  // común queda preseleccionado y registrar una venta es escribir el monto y listo.
  const [ultimoMedio, setUltimoMedio] = usePreferencia(`mov.ultimoMedio.${tipo}.${localId}`, null)
  const [medios, setMedios] = useState([])
  const [cargandoMedios, setCargandoMedios] = useState(true)
  const [medioId, setMedioId] = useState('')
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [alicuota, setAlicuota] = useState(21)
  const [comprobante, setComprobante] = useState('SIN_COMPROBANTE')
  const [puntoVenta, setPuntoVenta] = useState('')
  const [nroComprobante, setNroComprobante] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  // Un solo identificador por intento de cobro/gasto: se genera al abrir el
  // modal y SE REUSA en cada reintento (nunca se regenera solo). Si la
  // respuesta se pierde por un corte de red y la persona vuelve a tocar
  // "Cobrar", el segundo insert llega con la misma key y el índice único de
  // la base (tx_idempotency_key_unica) lo frena antes de duplicar la plata.
  const [idempotencyKey, setIdempotencyKey] = useState(null)

  const conIva = discriminaIva(local?.condicion_fiscal)

  useEffect(() => {
    if (isOpen) setIdempotencyKey(crypto.randomUUID())
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !localId) return
    setCargandoMedios(true)
    listarMediosPago(localId, { soloHabilitados: true })
      .then((data) => {
        setMedios(data)
        if (data.length) setMedioId((data.find(m => m.id === ultimoMedio) || data[0]).id)
      })
      .catch(() => toast.error('No se pudieron cargar los medios de pago'))
      .finally(() => setCargandoMedios(false))
    setComprobante(COMPROBANTE_POR_CONDICION[local?.condicion_fiscal] || 'SIN_COMPROBANTE')
    setAlicuota(conIva ? 21 : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const limpiar = () => { setMonto(''); setDescripcion(''); setArchivo(null); setPuntoVenta(''); setNroComprobante(''); setGuardando(false) }
  const cerrar = () => { limpiar(); onClose() }

  const elegirArchivo = (e) => {
    const file = e.target.files?.[0] || null
    if (!file) return setArchivo(null)
    const validacion = validarComprobante(file)
    if (!validacion.ok) {
      toast.error(validacion.error)
      e.target.value = ''
      return
    }
    setArchivo(file)
  }

  const guardar = async (e) => {
    e?.preventDefault()
    if (!medioId) return toast.error(`Elegí ${cfg.etiquetaMedio.toLowerCase()}`)
    if (!Number.isFinite(montoNum) || montoNum <= 0) return toast.error('Ingresá un monto mayor a cero')
    if (montoNum > MONTO_MAXIMO) return toast.error(`El monto no puede superar ${formatCurrency(MONTO_MAXIMO)}`)

    setGuardando(true)
    try {
      const tx = await cfg.servicio({
        localId, medioPagoId: medio.id, monto: montoNum, descripcion,
        alicuota: conIva ? alicuota : 0,
        tipoComprobante: comprobante,
        puntoVenta: puntoVenta.trim() || null,
        nroComprobante: nroComprobante.trim() || null,
        idempotencyKey,
      })
      await registrarAccion({
        localId, userId, accion: cfg.accion, tabla: 'transacciones', registroId: tx.id,
        detalles: { monto: montoNum, medio: medio?.nombre, descripcion },
      })
      setUltimoMedio(medio.id)
      toast.success(tipo === 'cobro' ? `Cobro de ${formatCurrency(montoNum)} registrado` : `Gasto de ${formatCurrency(montoNum)} registrado`)
      // El movimiento ya quedó guardado — si falla subir el comprobante, no
      // tiene sentido mostrar error de guardado: se avisa aparte y se puede
      // adjuntar después desde la lista del día.
      if (archivo) {
        subirComprobante(tx.id, localId, archivo)
          .catch((err) => toast.error(`El movimiento se guardó, pero el comprobante no se pudo subir: ${mensajeError(err)}`))
      }
      onSuccess?.()
      cerrar()
    } catch (err) {
      // Reintento de un intento que SÍ se guardó pero cuya respuesta se
      // perdió (corte de red): el índice único de la base lo frena en vez
      // de duplicar la plata. No es un error real — ya está guardado.
      if (err?.code === '23505' && err?.message?.includes('tx_idempotency_key_unica')) {
        toast.success(tipo === 'cobro' ? 'Este cobro ya se había guardado — no se repitió' : 'Este gasto ya se había guardado — no se repitió')
        onSuccess?.()
        cerrar()
        return
      }
      // Fallo real, pero puede que el servidor sí haya guardado el movimiento
      // y lo que se perdió sea solo la respuesta — no decirle "falló" sin
      // matices empuja a reintentar a ciegas. El reintento es seguro gracias
      // a la misma idempotencyKey, pero avisamos para que revise antes.
      toast.error(`No pudimos confirmar si se guardó: ${mensajeError(err)}. Revisá los movimientos antes de volver a intentarlo — si reintentás, no se va a duplicar.`)
      setGuardando(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title={cfg.titulo} size="sm"
      footer={<>
        <Button variant="secondary" onClick={cerrar} className="!rounded-[14px]">Cancelar</Button>
        <Button variant={cfg.variante} onClick={guardar} disabled={guardando} className="!rounded-[14px] min-h-[44px] flex-1 md:flex-none">
          {guardando ? 'Guardando…' : cfg.textoBoton}
        </Button>
      </>}>
      <form onSubmit={guardar} className="space-y-4">
        {/* Medio de pago primero: el teclado numérico que abre el monto (autoFocus,
            más abajo) tapa lo que esté debajo — así queda visible arriba. */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{cfg.etiquetaMedio}</label>
          <div className="grid grid-cols-2 gap-2">
            {medios.map((m) => (
              <button key={m.id} type="button" onClick={() => setMedioId(m.id)} aria-pressed={medioId === m.id}
                className={`press p-3 min-h-[48px] rounded-[14px] border-2 text-sm text-left cursor-pointer transition-colors ${
                  medioId === m.id ? 'border-primary-600 bg-primary-50 font-semibold' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <span className="mr-1">{m.icono || iconoMedio(m.tipo)}</span>{m.nombre}
                {verTecnico && m.comision_porcentaje > 0 && <div className="text-xs text-gray-500 font-normal">{m.comision_porcentaje}% comisión</div>}
              </button>
            ))}
          </div>
          {!cargandoMedios && medios.length === 0 && <p className="text-xs text-gray-500 m-0">No hay medios de pago configurados para este local.</p>}
        </div>

        <div>
          <label htmlFor="mov-monto" className="block text-sm font-semibold text-gray-700 mb-2">Monto</label>
          <input id="mov-monto" type="number" step="0.01" min="0" inputMode="decimal" value={monto} autoFocus required
            onChange={(e) => setMonto(e.target.value)} placeholder="0,00"
            className="w-full p-3.5 border border-gray-300 rounded-[14px] text-2xl font-bold focus:ring-2 focus:ring-primary-600 focus:border-primary-600 outline-none" />
        </div>

        <div>
          <label htmlFor="mov-desc" className="block text-sm font-semibold text-gray-700 mb-2">
            {tipo === 'cobro' ? 'Descripción (opcional)' : 'Proveedor o concepto'}
          </label>
          <input id="mov-desc" type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            placeholder={tipo === 'cobro' ? 'Ej: venta mostrador' : 'Ej: verdulería, luz, insumos'}
            className="w-full p-3 border border-gray-300 rounded-[14px] text-sm focus:ring-2 focus:ring-primary-600 focus:border-primary-600 outline-none" />
        </div>

        <div>
          <label htmlFor="mov-comprobante-archivo" className="block text-sm font-semibold text-gray-700 mb-2">
            Comprobante (foto o PDF, opcional)
          </label>
          <input id="mov-comprobante-archivo" type="file" accept="image/*,application/pdf" capture="environment"
            onChange={elegirArchivo}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-[12px] file:border-0 file:bg-primary-50 file:text-primary-700 file:font-semibold file:cursor-pointer" />
          {archivo && <p className="text-xs text-gray-500 mt-1 m-0">📎 {archivo.name}</p>}
        </div>

        {verTecnico && <details className="border border-gray-200 rounded-[14px]">
          <summary className="p-3 text-sm font-semibold text-gray-700 cursor-pointer">Facturación</summary>
          <div className="p-3 pt-0 space-y-3">
            <div>
              <label htmlFor="mov-comprobante" className="block text-xs font-semibold text-gray-600 mb-1">Comprobante</label>
              <select id="mov-comprobante" value={comprobante} onChange={(e) => setComprobante(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-[12px] text-sm">
                {TIPOS_COMPROBANTE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="mov-punto-venta" className="block text-xs font-semibold text-gray-600 mb-1">Punto de venta (opcional)</label>
                <input id="mov-punto-venta" type="text" value={puntoVenta} onChange={(e) => setPuntoVenta(e.target.value)}
                  placeholder="Ej: 0001" className="w-full p-2 border border-gray-300 rounded-[12px] text-sm" />
              </div>
              <div>
                <label htmlFor="mov-nro-comprobante" className="block text-xs font-semibold text-gray-600 mb-1">Número (opcional)</label>
                <input id="mov-nro-comprobante" type="text" value={nroComprobante} onChange={(e) => setNroComprobante(e.target.value)}
                  placeholder="Ej: 00012345" className="w-full p-2 border border-gray-300 rounded-[12px] text-sm" />
              </div>
            </div>
            {conIva && (
              <div>
                <label htmlFor="mov-alicuota" className="block text-xs font-semibold text-gray-600 mb-1">IVA</label>
                <select id="mov-alicuota" value={alicuota} onChange={(e) => setAlicuota(parseFloat(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-[12px] text-sm">
                  {ALICUOTAS_IVA.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            )}
          </div>
        </details>}

        {verTecnico && previa && (
          <div className="bg-gray-50 border border-gray-200 rounded-[14px] p-3 text-xs space-y-1">
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

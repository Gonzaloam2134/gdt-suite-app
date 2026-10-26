import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { formatCurrency, formatFechaHora } from '../../lib/format'
import { esValido, esAsientoInverso, estaAnulado, esPago } from '../../lib/domain/cuentaCorriente'
import { useMovimientosCc } from '../../hooks/useMovimientosCc'
import { registrarAccion } from '../../lib/services/auditoria'
import { ACCIONES } from '../../lib/constants/auditoria'
import AnotarConsumoModal from './AnotarConsumoModal'
import RegistrarPagoCcModal from './RegistrarPagoCcModal'
import AnularMovimientoCcModal from './AnularMovimientoCcModal'

const filaClase = (m) => {
  if (esAsientoInverso(m)) return 'opacity-60 italic'
  if (estaAnulado(m)) return 'opacity-50 line-through'
  return ''
}

/** Historial de un cliente: saldo, anotar consumo, registrar pago, anular cualquier movimiento. */
export default function MovimientosCcModal({ isOpen, onClose, cliente, localId, mediosPago, userId, onCambio }) {
  const { movimientos, saldo, cargando, anotarConsumo, registrarPago, anular } = useMovimientosCc(cliente?.id)
  const [modal, setModal] = useState(null) // 'consumo' | 'pago' | null
  const [aAnular, setAAnular] = useState(null)

  if (!cliente) return null

  const refrescar = async (accion, logear) => {
    const fila = await accion()
    if (logear) await logear(fila).catch((err) => console.error('[MovimientosCcModal] auditoría', err))
    onCambio?.()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={cliente.nombre} subtitle={cliente.identificador} size="lg"
      footer={<>
        <Button variant="secondary" onClick={() => setModal('consumo')} className="flex-1">Anotar consumo</Button>
        <Button variant="success" onClick={() => setModal('pago')} className="flex-1">Registrar pago</Button>
      </>}>
      <div className={`rounded-[16px] p-4 mb-4 text-center ${saldo > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
        <p className="text-xs text-gray-500 m-0">{saldo > 0 ? 'Debe' : 'Saldo'}</p>
        <p className={`text-2xl font-extrabold m-0 ${saldo > 0 ? 'text-amber-700' : 'text-green-700'}`}>
          {formatCurrency(Math.abs(saldo))}{saldo < 0 && <span className="text-xs font-normal"> a favor</span>}
        </p>
      </div>

      {cargando ? (
        <p className="text-sm text-gray-400 text-center py-6">Cargando movimientos…</p>
      ) : movimientos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Todavía no hay movimientos.</p>
      ) : (
        <ul className="space-y-2 pl-0 list-none">
          {movimientos.map(m => (
            <li key={m.id} className={`flex items-center justify-between gap-3 border border-gray-100 rounded-[12px] p-3 text-sm ${filaClase(m)}`}>
              <div className="min-w-0">
                <span className={`font-semibold ${esPago(m) ? 'text-green-700' : 'text-gray-900'}`}>
                  {esPago(m) ? 'Pago' : 'Consumo'}
                </span>
                {m.descripcion && <span className="block text-gray-500 text-xs truncate">{m.descripcion}</span>}
                <span className="block text-gray-400 text-xs">{formatFechaHora(m.creado_en)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold">{formatCurrency(m.monto)}</span>
                {esValido(m) && (
                  <button onClick={() => setAAnular(m)} className="text-xs text-amber-700 underline bg-transparent border-none cursor-pointer">
                    Anular
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AnotarConsumoModal isOpen={modal === 'consumo'} onClose={() => setModal(null)} clienteNombre={cliente.nombre}
        onGuardar={(monto, descripcion) => refrescar(
          () => anotarConsumo({ localId, monto, descripcion, creadoPor: userId }),
          (fila) => registrarAccion({ localId, userId, accion: ACCIONES.CONSUMO_CC_REGISTRADO, tabla: 'movimientos_cc', registroId: fila.id, detalles: { cliente: cliente.nombre, monto, descripcion } }),
        )} />

      <RegistrarPagoCcModal isOpen={modal === 'pago'} onClose={() => setModal(null)} clienteNombre={cliente.nombre}
        saldo={saldo} mediosPago={mediosPago}
        onGuardar={(monto, medioPagoId) => refrescar(
          () => registrarPago({ localId, medioPagoId, monto, creadoPor: userId }),
          (fila) => registrarAccion({ localId, userId, accion: ACCIONES.PAGO_CC_REGISTRADO, tabla: 'movimientos_cc', registroId: fila.id, detalles: { cliente: cliente.nombre, monto } }),
        )} />

      <AnularMovimientoCcModal isOpen={!!aAnular} onClose={() => setAAnular(null)} movimiento={aAnular}
        onConfirmar={(m, motivo) => refrescar(
          () => anular(m, motivo),
          (fila) => registrarAccion({ localId, userId, accion: ACCIONES.MOVIMIENTO_CC_ANULADO, tabla: 'movimientos_cc', registroId: fila.id, detalles: { cliente: cliente.nombre, original: m.id, motivo } }),
        )} />
    </Modal>
  )
}

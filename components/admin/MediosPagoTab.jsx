import { useState } from 'react'
import toast from 'react-hot-toast'
import { crearMedioPago, setMedioHabilitado, eliminarMedioPago, actualizarMedioPago } from '../../lib/services/mediosPago'
import { registrarAccion } from '../../lib/services/auditoria'
import { ACCIONES } from '../../lib/constants/auditoria'
import { LABEL_TIPO_MEDIO, iconoMedio } from '../../lib/constants/mediosPago'
import Button from '../ui/Button'
import Switch from '../ui/Switch'
import ConfirmDialog from '../ui/ConfirmDialog'
import EmptyState from '../ui/EmptyState'
import EditarMedioPagoModal from './EditarMedioPagoModal'
import NuevoMedioPagoModal from './NuevoMedioPagoModal'

const textoPlazo = (dias) => (dias > 0 ? `acredita en ${dias} día${dias === 1 ? '' : 's'}` : 'acredita al instante')

export default function MediosPagoTab({ mediosPago, localId, userId, onCambio }) {
  const [creando, setCreando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [aEditar, setAEditar] = useState(null)
  const [editando, setEditando] = useState(false)

  const agregar = async (form) => {
    if (!form.nombre.trim()) { toast.error('Poné un nombre para el medio de pago'); return false }
    setGuardando(true)
    try {
      await crearMedioPago({
        localId, nombre: form.nombre.trim(), tipo: form.tipo,
        comision: parseFloat(form.comision) || 0,
        plazo: parseInt(form.plazo, 10) || 0,
        creadoPor: userId, orden: mediosPago.length,
      })
      await registrarAccion({ localId, userId, accion: ACCIONES.MEDIO_PAGO_CREADO, detalles: { nombre: form.nombre, tipo: form.tipo } })
      toast.success('Medio de pago agregado')
      onCambio()
      return true
    } catch (err) {
      toast.error(`No se pudo agregar: ${err.message}`)
      return false
    } finally { setGuardando(false) }
  }

  const guardarEdicion = async (cambios) => {
    setEditando(true)
    try {
      await actualizarMedioPago(aEditar.id, cambios)
      await registrarAccion({
        localId, userId, accion: ACCIONES.MEDIO_PAGO_EDITADO, tabla: 'medios_pago', registroId: aEditar.id,
        detalles: {
          nombre: cambios.nombre,
          comision_anterior: aEditar.comision_porcentaje, comision_nueva: cambios.comision_porcentaje,
          plazo_anterior: aEditar.plazo_acreditacion_dias, plazo_nuevo: cambios.plazo_acreditacion_dias,
        },
      })
      toast.success('Medio de pago actualizado')
      setAEditar(null)
      onCambio()
    } catch (err) {
      toast.error(`No se pudo actualizar: ${err.message}`)
    } finally { setEditando(false) }
  }

  const alternar = async (medio) => {
    try {
      await setMedioHabilitado(medio.id, !medio.habilitado)
      toast.success(medio.habilitado ? 'Medio desactivado' : 'Medio activado')
      onCambio()
    } catch (err) { toast.error(`No se pudo cambiar: ${err.message}`) }
  }

  const confirmarEliminar = async () => {
    try {
      await eliminarMedioPago(aEliminar.id)
      toast.success('Medio de pago eliminado')
      setAEliminar(null)
      onCambio()
    } catch (err) {
      toast.error('No se puede eliminar un medio con movimientos registrados. Desactivalo en su lugar.')
      setAEliminar(null)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-gray-500 m-0 pt-1">
          Cambiar la comisión o el plazo de un medio rige de ahora en adelante: los cobros ya cargados conservan los valores con los que se hicieron.
        </p>
        <Button variant="success" onClick={() => setCreando(true)} className="!rounded-[14px] shrink-0 min-h-[44px]">+ Agregar</Button>
      </div>

      {mediosPago.length === 0 ? (
        <EmptyState icono="tarjeta" titulo="No hay medios de pago" descripcion="Agregá al menos efectivo para poder registrar cobros." />
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {mediosPago.map(m => (
            <li key={m.id} className={`flex items-center gap-1 bg-white rounded-[20px] border border-black/5 shadow-suave transition-opacity ${m.habilitado ? '' : 'opacity-60'}`}>
              <button onClick={() => setAEditar(m)} aria-label={`Editar ${m.nombre}`}
                className="press flex-1 min-w-0 flex items-center gap-3 p-3 pl-4 text-left bg-transparent border-none cursor-pointer rounded-[20px] hover:bg-gray-50">
                <span className="text-2xl shrink-0">{m.icono || iconoMedio(m.tipo)}</span>
                <span className="min-w-0">
                  <span className="block font-semibold text-gray-900 text-sm truncate">{m.nombre}</span>
                  <span className="block text-xs text-gray-500">
                    {LABEL_TIPO_MEDIO[m.tipo] || m.tipo} · <strong className="font-semibold text-gray-700">{Number(m.comision_porcentaje) || 0}%</strong> comisión · {textoPlazo(m.plazo_acreditacion_dias)}
                  </span>
                </span>
              </button>
              <div className="pr-2 flex items-center">
                <Switch checked={!!m.habilitado} onChange={() => alternar(m)} label={`${m.habilitado ? 'Desactivar' : 'Activar'} ${m.nombre}`} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <NuevoMedioPagoModal isOpen={creando} onClose={() => setCreando(false)} onGuardar={agregar} procesando={guardando} />

      <EditarMedioPagoModal isOpen={!!aEditar} onClose={() => setAEditar(null)} medio={aEditar}
        onGuardar={guardarEdicion} procesando={editando}
        onEliminar={() => { setAEliminar(aEditar); setAEditar(null) }} />

      <ConfirmDialog isOpen={!!aEliminar} onClose={() => setAEliminar(null)} onConfirm={confirmarEliminar} danger
        title="Eliminar medio de pago"
        message={`Se elimina "${aEliminar?.nombre}". Si ya tiene cobros registrados no se va a poder borrar: en ese caso desactivalo.`}
        confirmLabel="Eliminar" />
    </div>
  )
}

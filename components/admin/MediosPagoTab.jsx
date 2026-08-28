import { useState } from 'react'
import toast from 'react-hot-toast'
import { crearMedioPago, setMedioHabilitado, eliminarMedioPago, actualizarMedioPago } from '../../lib/services/mediosPago'
import { registrarAccion } from '../../lib/services/auditoria'
import { ACCIONES } from '../../lib/constants/auditoria'
import { TIPOS_MEDIO, LABEL_TIPO_MEDIO, iconoMedio } from '../../lib/constants/mediosPago'
import ConfirmDialog from '../ui/ConfirmDialog'
import EmptyState from '../ui/EmptyState'
import EditarMedioPagoModal from './EditarMedioPagoModal'

const FORM_VACIO = { nombre: '', tipo: TIPOS_MEDIO.EFECTIVO, comision: '', plazo: '' }

export default function MediosPagoTab({ mediosPago, localId, userId, onCambio }) {
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [aEditar, setAEditar] = useState(null)
  const [editando, setEditando] = useState(false)

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))

  const agregar = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) return toast.error('Poné un nombre para el medio de pago')
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
      setForm(FORM_VACIO)
      onCambio()
    } catch (err) {
      toast.error(`No se pudo agregar: ${err.message}`)
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
    <div className="space-y-4">
      <form onSubmit={agregar} className="bg-white p-4 rounded-xl border border-gray-200">
        <h3 className="text-base font-bold text-gray-900 mb-3 m-0">Agregar medio de pago</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input type="text" value={form.nombre} onChange={set('nombre')} required placeholder="Nombre (ej: Mercado Pago)" aria-label="Nombre"
            className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <select value={form.tipo} onChange={set('tipo')} aria-label="Tipo" className="p-2.5 border border-gray-300 rounded-lg text-sm">
            {Object.values(TIPOS_MEDIO).map(t => <option key={t} value={t}>{iconoMedio(t)} {LABEL_TIPO_MEDIO[t]}</option>)}
          </select>
          <input type="number" step="0.01" min="0" value={form.comision} onChange={set('comision')} placeholder="Comisión % (ej: 3.5)" aria-label="Comisión"
            className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <input type="number" min="0" value={form.plazo} onChange={set('plazo')} placeholder="Días hasta que acredita" aria-label="Plazo de acreditación"
            className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <button type="submit" disabled={guardando}
          className="mt-3 w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 disabled:opacity-50">
          {guardando ? 'Agregando…' : 'Agregar medio de pago'}
        </button>
      </form>

      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">Configurados ({mediosPago.length})</h3>
        {mediosPago.length === 0 ? (
          <EmptyState icono="💳" titulo="No hay medios de pago" descripcion="Agregá al menos efectivo para poder registrar cobros." />
        ) : (
          <div className="space-y-2">
            {mediosPago.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-gray-200 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-2xl shrink-0">{m.icono || iconoMedio(m.tipo)}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{m.nombre}</div>
                    <div className="text-xs text-gray-500">
                      {LABEL_TIPO_MEDIO[m.tipo] || m.tipo}
                      {m.comision_porcentaje > 0 && ` · ${m.comision_porcentaje}% comisión`}
                      {m.plazo_acreditacion_dias > 0 ? ` · acredita en ${m.plazo_acreditacion_dias} días` : ' · acredita al instante'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${m.habilitado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.habilitado ? 'Activo' : 'Inactivo'}
                  </span>
                  <button onClick={() => setAEditar(m)} className="px-3 py-1 bg-blue-100 text-blue-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-blue-200">Editar</button>
                  <button onClick={() => alternar(m)} className="px-3 py-1 bg-amber-100 text-amber-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-amber-200">
                    {m.habilitado ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => setAEliminar(m)} className="px-3 py-1 bg-red-100 text-red-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-red-200">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EditarMedioPagoModal isOpen={!!aEditar} onClose={() => setAEditar(null)} medio={aEditar}
        onGuardar={guardarEdicion} procesando={editando} />

      <ConfirmDialog isOpen={!!aEliminar} onClose={() => setAEliminar(null)} onConfirm={confirmarEliminar} danger
        title="Eliminar medio de pago"
        message={`Se elimina "${aEliminar?.nombre}". Si ya tiene cobros registrados no se va a poder borrar: en ese caso desactivalo.`}
        confirmLabel="Eliminar" />
    </div>
  )
}

import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { TIPOS_MEDIO, LABEL_TIPO_MEDIO, iconoMedio } from '../../lib/constants/mediosPago'

/**
 * Edita un medio de pago existente.
 * Aviso clave: cambiar la comisión no reescribe los cobros ya registrados, porque
 * cada transacción guarda la comisión con la que se hizo. Los reportes viejos
 * siguen siendo correctos y el cambio rige de acá en adelante.
 */
export default function EditarMedioPagoModal({ isOpen, onClose, medio, onGuardar, procesando }) {
  const [form, setForm] = useState({ nombre: '', tipo: '', comision: '', plazo: '' })

  useEffect(() => {
    if (!medio) return
    setForm({
      nombre: medio.nombre || '',
      tipo: medio.tipo || TIPOS_MEDIO.OTRO,
      comision: String(medio.comision_porcentaje ?? 0),
      plazo: String(medio.plazo_acreditacion_dias ?? 0),
    })
  }, [medio])

  if (!medio) return null

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))
  const comisionNueva = parseFloat(form.comision) || 0
  const comisionAnterior = Number(medio.comision_porcentaje) || 0
  const cambioComision = comisionNueva !== comisionAnterior
  const plazoNuevo = parseInt(form.plazo, 10) || 0
  const cambioPlazo = plazoNuevo !== (Number(medio.plazo_acreditacion_dias) || 0)

  const guardar = () => onGuardar({
    nombre: form.nombre.trim(),
    tipo: form.tipo,
    icono: iconoMedio(form.tipo),
    comision_porcentaje: comisionNueva,
    plazo_acreditacion_dias: plazoNuevo,
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar medio de pago" subtitle={medio.nombre}
      footer={<>
        <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Cancelar</button>
        <button onClick={guardar} disabled={procesando || !form.nombre.trim()}
          className="px-4 py-2.5 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 disabled:opacity-50">
          {procesando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label htmlFor="mp-nombre" className="block text-sm font-semibold text-gray-700 mb-2">Nombre</label>
          <input id="mp-nombre" type="text" value={form.nombre} onChange={set('nombre')}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <div>
          <label htmlFor="mp-tipo" className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
          <select id="mp-tipo" value={form.tipo} onChange={set('tipo')}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm">
            {Object.values(TIPOS_MEDIO).map(t => (
              <option key={t} value={t}>{iconoMedio(t)} {LABEL_TIPO_MEDIO[t]}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1 m-0">El efectivo es el único que cuenta para el arqueo de caja.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="mp-comision" className="block text-sm font-semibold text-gray-700 mb-2">Comisión %</label>
            <input id="mp-comision" type="number" step="0.01" min="0" value={form.comision} onChange={set('comision')}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label htmlFor="mp-plazo" className="block text-sm font-semibold text-gray-700 mb-2">Días de acreditación</label>
            <input id="mp-plazo" type="number" min="0" value={form.plazo} onChange={set('plazo')}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>

        {(cambioComision || cambioPlazo) && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-semibold text-amber-900 m-0">Este cambio rige de ahora en adelante</p>
            <p className="text-xs text-amber-800 mt-1 m-0">
              {cambioComision && `La comisión pasa de ${comisionAnterior}% a ${comisionNueva}%. `}
              {cambioPlazo && `El plazo pasa de ${medio.plazo_acreditacion_dias || 0} a ${plazoNuevo} días. `}
              Los cobros ya registrados conservan los valores con los que se cargaron, así que
              los reportes de períodos anteriores no cambian.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

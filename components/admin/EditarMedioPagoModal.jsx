import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { TIPOS_MEDIO, LABEL_TIPO_MEDIO, iconoMedio } from '../../lib/constants/mediosPago'

const COMISION_MAXIMA = 100
const PLAZO_MAXIMO = 365

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

  // Antes un valor vacío o inválido se convertía en 0 en silencio (`parseFloat(x) || 0`),
  // así que borrar el campo por error guardaba "0% comisión" sin ningún aviso.
  // Ahora un valor inválido bloquea "Guardar" en vez de reemplazarlo por 0.
  const comisionNum = Number(form.comision)
  const comisionValida = form.comision.trim() !== '' && Number.isFinite(comisionNum) && comisionNum >= 0 && comisionNum <= COMISION_MAXIMA
  const plazoNum = Number(form.plazo)
  const plazoValido = form.plazo.trim() !== '' && Number.isInteger(plazoNum) && plazoNum >= 0 && plazoNum <= PLAZO_MAXIMO
  const formValido = !!form.nombre.trim() && comisionValida && plazoValido

  const comisionAnterior = Number(medio.comision_porcentaje) || 0
  const cambioComision = comisionValida && comisionNum !== comisionAnterior
  const plazoAnterior = Number(medio.plazo_acreditacion_dias) || 0
  const cambioPlazo = plazoValido && plazoNum !== plazoAnterior

  const guardar = () => {
    if (!formValido) return
    onGuardar({
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      icono: iconoMedio(form.tipo),
      comision_porcentaje: comisionNum,
      plazo_acreditacion_dias: plazoNum,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar medio de pago" subtitle={medio.nombre}
      footer={<>
        <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Cancelar</button>
        <button onClick={guardar} disabled={procesando || !formValido}
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
            <input id="mp-comision" type="number" step="0.01" min="0" max={COMISION_MAXIMA} value={form.comision} onChange={set('comision')}
              aria-invalid={!comisionValida}
              className={`w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${comisionValida ? 'border-gray-300' : 'border-red-400'}`} />
            {!comisionValida && <p className="text-xs text-red-600 mt-1 m-0">Ingresá un número entre 0 y {COMISION_MAXIMA}.</p>}
          </div>
          <div>
            <label htmlFor="mp-plazo" className="block text-sm font-semibold text-gray-700 mb-2">Días de acreditación</label>
            <input id="mp-plazo" type="number" min="0" max={PLAZO_MAXIMO} step="1" value={form.plazo} onChange={set('plazo')}
              aria-invalid={!plazoValido}
              className={`w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${plazoValido ? 'border-gray-300' : 'border-red-400'}`} />
            {!plazoValido && <p className="text-xs text-red-600 mt-1 m-0">Ingresá un número entero entre 0 y {PLAZO_MAXIMO}.</p>}
          </div>
        </div>

        {(cambioComision || cambioPlazo) && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-semibold text-amber-900 m-0">Este cambio rige de ahora en adelante</p>
            <p className="text-xs text-amber-800 mt-1 m-0">
              {cambioComision && `La comisión pasa de ${comisionAnterior}% a ${comisionNum}%. `}
              {cambioPlazo && `El plazo pasa de ${medio.plazo_acreditacion_dias || 0} a ${plazoNum} días. `}
              Los cobros ya registrados conservan los valores con los que se cargaron, así que
              los reportes de períodos anteriores no cambian.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

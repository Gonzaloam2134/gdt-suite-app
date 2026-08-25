import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

// Iconos automáticos por tipo de medio de pago
const ICONOS_POR_TIPO = {
  efectivo: '💵',
  debito: '💳',
  credito: '',
  transferencia: '🏦',
  qr: '📱',
  cheque: '',
  otro: '📦'
}

// Medios de pago presets
const MEDIOS_PRESET = [
  { nombre: 'Efectivo', tipo: 'efectivo', icono: '', comision: 0, plazo: 0, habilitado: true },
  { nombre: 'Tarjeta de Débito', tipo: 'debito', icono: '', comision: 0, plazo: 1, habilitado: true },
  { nombre: 'Tarjeta de Crédito', tipo: 'credito', icono: '', comision: 3.5, plazo: 30, habilitado: true },
  { nombre: 'Transferencia', tipo: 'transferencia', icono: '🏦', comision: 0, plazo: 0, habilitado: true },
  { nombre: 'Mercado Pago QR', tipo: 'qr', icono: '📱', comision: 1.99, plazo: 1, habilitado: false },
]

export default function OnboardingWizard({ onComplete, onCancel, userEmail, preloadedData, skipScaleStep = false }) {
  const [step, setStep] = useState(skipScaleStep ? 1 : 1) // Si skipScaleStep es true, empezamos en 1 pero saltaremos el 2
  const [formData, setFormData] = useState(preloadedData || {
    businessName: '',
    rubro: 'Gastronomía',
    condicionFiscal: 'Consumidor Final',
    escala: '1', // 1, 2-5, 5+
    mediosPago: MEDIOS_PRESET,
    invites: []
  })

  // Guardar progreso en localStorage
  useEffect(() => {
    localStorage.setItem('onboarding_temp_data', JSON.stringify(formData))
  }, [formData])

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleMedioPago = (index) => {
    const nuevosMedios = [...formData.mediosPago]
    nuevosMedios[index].habilitado = !nuevosMedios[index].habilitado
    updateField('mediosPago', nuevosMedios)
  }

  const handleNext = () => {
    // Validaciones por paso
    if (step === 1 && !formData.businessName.trim()) {
      toast.error('Por favor, ingresá el nombre de tu negocio')
      return
    }

    // ✅ LÓGICA PARA SALTAR EL PASO DE ESCALA
    if (step === 1 && skipScaleStep) {
      // Si estamos agregando un local extra, saltamos directamente al paso de medios de pago (paso 3)
      setStep(3)
      return
    }

    if (step === 2 && !formData.escala) {
      toast.error('Seleccioná una opción de escala')
      return
    }

    if (step === 3) {
      const habilitados = formData.mediosPago.filter(m => m.habilitado)
      if (habilitados.length === 0) {
        toast.error('Debés habilitar al menos un medio de pago')
        return
      }
    }

    setStep(prev => prev + 1)
  }

  const handleBack = () => {
    // Si volvemos del paso 3 y skipScaleStep es true, volvemos al 1 (no al 2)
    if (step === 3 && skipScaleStep) {
      setStep(1)
      return
    }
    setStep(prev => prev - 1)
  }

  const handleSubmit = () => {
    localStorage.removeItem('onboarding_temp_data')
    onComplete(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        
        {/* Header con progreso */}
        <div className="bg-slate-50 p-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {step === 1 && '🏪 Datos del Negocio'}
              {step === 2 && '📊 Tu Escala'}
              {step === 3 && '💳 Medios de Pago'}
              {step === 4 && '✅ Resumen Final'}
            </h2>
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
              Paso {step} de {skipScaleStep ? '3' : '4'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(step / (skipScaleStep ? 3 : 4)) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Contenido del paso */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          
          {/* PASO 1: Datos del negocio */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre del Negocio *</label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => updateField('businessName', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ej: Kiosco Don Pepe"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Rubro</label>
                <select
                  value={formData.rubro}
                  onChange={(e) => updateField('rubro', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="Gastronomía">Gastronomía</option>
                  <option value="Indumentaria y Calzado">Indumentaria y Calzado</option>
                  <option value="Alimentos y Bebidas">Alimentos y Bebidas (Almacén, Panadería, etc.)</option>
                  <option value="Salud y Belleza">Salud y Belleza</option>
                  <option value="Servicios Profesionales">Servicios Profesionales</option>
                  <option value="Tecnología y Comunicaciones">Tecnología y Comunicaciones</option>
                  <option value="Ferreteria"></option>
                  <option value="Pintureria"></option>
                  <option value="Materiales Electricos"></option>
                  <option value="Hogar y Construcción">Hogar y Construcción</option>
                  <option value="Automotor">Automotor</option>
                  <option value="Educación y Cultura">Educación y Cultura</option>
                  <option value="Deporte y Recreación">Deporte y Recreación</option>
                  <option value="Mascotas">Mascotas</option>
                  <option value="Servicios del Hogar">Servicios del Hogar</option>
                  <option value="Entretenimiento">Entretenimiento</option>
                  <option value="Inmobiliaria">Inmobiliaria</option>
                  <option value="Otros">Otros</option>
                </select>
              
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Condición Fiscal</label>
                <select
                  value={formData.condicionFiscal}
                  onChange={(e) => updateField('condicionFiscal', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="Consumidor Final">Consumidor Final</option>
                  <option value="Monotributo">Monotributo</option>
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                </select>
              </div>
            </div>
          )}

          {/* PASO 2: Tu Escala (SOLO si NO es skipScaleStep) */}
          {step === 2 && !skipScaleStep && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 m-0">
                  💡 Esto nos ayuda a configurar tu cuenta de la mejor manera.
                </p>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-4">
                ¿Cuántos locales o sucursales planeas manejar en GDT Suite?
              </h3>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => updateField('escala', '1')}
                  className={`w-full p-4 border-2 rounded-xl text-left transition-all ${
                    formData.escala === '1' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-gray-900">1 Local</div>
                  <div className="text-sm text-gray-600 mt-1">Ideal para emprendedores y negocios unipersonales.</div>
                </button>
                <button
                  type="button"
                  onClick={() => updateField('escala', '2-5')}
                  className={`w-full p-4 border-2 rounded-xl text-left transition-all ${
                    formData.escala === '2-5' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-gray-900">2 a 5 Locales</div>
                  <div className="text-sm text-gray-600 mt-1">Perfecto para cadenas pequeñas o franquicias.</div>
                </button>
                <button
                  type="button"
                  onClick={() => updateField('escala', '5+')}
                  className={`w-full p-4 border-2 rounded-xl text-left transition-all ${
                    formData.escala === '5+' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-gray-900">Más de 5 Locales</div>
                  <div className="text-sm text-gray-600 mt-1">Para empresas en expansión (Plan Enterprise).</div>
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: Medios de Pago */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-2">
                Seleccioná los medios de pago que vas a aceptar. Podés cambiar esto después en el Panel de Admin.
              </p>
              <div className="space-y-3">
                {formData.mediosPago.map((medio, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                      medio.habilitado ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{medio.icono}</span>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{medio.nombre}</div>
                        <div className="text-xs text-gray-500">
                          {medio.comision > 0 ? `${medio.comision}% comisión` : 'Sin comisión'} · {' '}
                          {medio.plazo === 0 ? 'Inmediato' : `${medio.plazo} días`}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleMedioPago(index)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        medio.habilitado ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          medio.habilitado ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PASO 4: Resumen Final */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-green-800 m-0 font-medium">
                  ✅ ¡Todo listo! Revisá tu configuración.
                </p>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Negocio:</span>
                  <span className="font-semibold text-gray-900">{formData.businessName}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Rubro:</span>
                  <span className="font-semibold text-gray-900">{formData.rubro}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Condición Fiscal:</span>
                  <span className="font-semibold text-gray-900">{formData.condicionFiscal}</span>
                </div>
                {!skipScaleStep && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Escala:</span>
                    <span className="font-semibold text-gray-900">
                      {formData.escala === '1' && '1 Local'}
                      {formData.escala === '2-5' && '2 a 5 Locales'}
                      {formData.escala === '5+' && 'Más de 5 Locales'}
                    </span>
                  </div>
                )}
                
                <div className="pt-2">
                  <span className="text-gray-500 block mb-2">Medios de pago configurados:</span>
                  <div className="space-y-2">
                    {formData.mediosPago.map((medio, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <span>{medio.habilitado ? '✅' : '❌'}</span>
                        <span className="text-lg">{medio.icono}</span>
                        <span className={medio.habilitado ? 'text-gray-900 font-medium' : 'text-gray-400 line-through'}>
                          {medio.nombre}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                  <p className="text-xs text-amber-800 m-0 flex items-start gap-2">
                    <span>ℹ️</span>
                    <span>
                      Podés agregar o modificar medios de pago en cualquier momento desde el <strong>Panel de Administración</strong>.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer con botones */}
        <div className="p-6 bg-slate-50 border-t border-gray-200 flex justify-between">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-50 transition-colors"
            >
              ← Atrás
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-500 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          )}
          
          {step < 4 ? (
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-700 transition-colors shadow-sm"
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"
            >
              🚀 Crear mi Local
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

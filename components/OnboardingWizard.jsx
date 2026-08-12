import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import toast from 'react-hot-toast'

const RUBROS = ['Gastronomía', 'Retail / Tienda', 'Servicios', 'Salud / Estética', 'Educación', 'Otro']
const CONDICIONES = ['Monotributo', 'Responsable Inscripto', 'Exento', 'Consumidor Final']

// Descripciones cortas y precisas de cada rol
const ROLES_INFO = {
  cajero: {
    titulo: 'Cajero',
    icono: '👨‍💼',
    descripcion: 'Opera la caja, registra ventas y gastos/pagos. Ve los totales del día.',
    puede: [
      'Abrir/cerrar caja',
      'Registrar ventas',
      'Registrar gastos/pagos',
      'Ver resumen diario',
      'Ver reportes'
    ],
    noPuede: [
      'Crear medios de pago',
      'Eliminar ventas registradas',
      'Invitar usuarios'
    ]
  },
  empleado: {
    titulo: 'Empleado',
    icono: '👷',
    descripcion: 'Solo registra ventas del mostrador. No ve totales ni opera la caja.',
    puede: [
      'Registrar ventas (cobros a clientes)'
    ],
    noPuede: [
      'Registrar gastos/pagos',
      'Operar caja',
      'Ver totales',
      'Ver reportes'
    ]
  }
}

export default function OnboardingWizard({ onComplete, onCancel, userEmail }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [skipTeamInvite, setSkipTeamInvite] = useState(false)
  
  const [formData, setFormData] = useState({
    businessName: '',
    rubro: '',
    condicionFiscal: '',
    numLocales: '1'
  })

  // Estado para el paso 4: invitaciones
  const [invites, setInvites] = useState([])
  const [newInviteEmail, setNewInviteEmail] = useState('')
  const [newInviteRole, setNewInviteRole] = useState('cajero')
  const [showRoleInfo, setShowRoleInfo] = useState(null)

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    if (step === 1) {
      if (!formData.businessName.trim()) {
        toast.error('El nombre del negocio es obligatorio')
        return
      }
      if (!formData.rubro) {
        toast.error('Seleccioná un rubro')
        return
      }
    }
    setStep(step + 1)
  }

  const addInvite = () => {
    if (!newInviteEmail || !newInviteEmail.includes('@')) {
      toast.error('Ingresá un email válido')
      return
    }
    
    // Verificar que no esté duplicado
    if (invites.some(inv => inv.email === newInviteEmail.toLowerCase())) {
      toast.error('Este email ya fue agregado')
      return
    }

    setInvites([...invites, { email: newInviteEmail.toLowerCase(), rol: newInviteRole }])
    setNewInviteEmail('')
    setNewInviteRole('cajero')
  }

  const removeInvite = (index) => {
    setInvites(invites.filter((_, i) => i !== index))
  }

  const handleFinish = async () => {
    try {
      setLoading(true)
      
      // Devolver los datos + invitaciones al padre
      onComplete({ ...formData, invites })
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* HEADER & PROGRESS */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="m-0 text-xl font-bold text-gray-900">
              {step === 1 ? '👋 Bienvenido' : step === 2 ? '📏 Tu Escala' : step === 3 ? '🚀 ¡Casi listo!' : '👥 Tu Equipo'}
            </h2>
            <button onClick={onCancel} className="bg-none border-none text-xl cursor-pointer text-gray-400 hover:text-gray-600">✕</button>
          </div>
          
          {/* Barra de progreso */}
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => (
              <div 
                key={i} 
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">Paso {step} de 4</p>
        </div>

        {/* PASO 1: DATOS DEL NEGOCIO */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Contanos un poco sobre tu negocio para personalizar tu experiencia.</p>
            
            <div>
              <label className="block mb-2 font-semibold text-gray-700 text-sm">Nombre del negocio *</label>
              <input
                type="text"
                value={formData.businessName}
                onChange={e => updateField('businessName', e.target.value)}
                placeholder="Ej: Panadería Los Trigales"
                className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold text-gray-700 text-sm">Rubro principal *</label>
              <div className="grid grid-cols-2 gap-2">
                {RUBROS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => updateField('rubro', r)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium cursor-pointer transition-all ${
                      formData.rubro === r 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block mb-2 font-semibold text-gray-700 text-sm">Condición Fiscal *</label>
              <select
                value={formData.condicionFiscal}
                onChange={e => updateField('condicionFiscal', e.target.value)}
                className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border bg-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Seleccionar...</option>
                {CONDICIONES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* PASO 2: ESCALA */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">¿Cuántos locales o sucursales planeas manejar en GDT Suite?</p>
            
            <div className="grid grid-cols-1 gap-3">
              {[
                { val: '1', label: '1 Local', desc: 'Ideal para emprendedores y negocios unipersonales.' },
                { val: '2-5', label: '2 a 5 Locales', desc: 'Perfecto para cadenas pequeñas o franquicias.' },
                { val: '+5', label: 'Más de 5 Locales', desc: 'Para empresas en expansión (Plan Enterprise).' }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => updateField('numLocales', opt.val)}
                  className={`p-4 rounded-xl border-2 text-left cursor-pointer transition-all ${
                    formData.numLocales === opt.val 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-gray-900">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASO 3: RESUMEN */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Revisá que todo esté correcto antes de empezar.</p>
            
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Negocio:</span>
                <span className="text-sm font-bold text-gray-900">{formData.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Rubro:</span>
                <span className="text-sm font-bold text-gray-900">{formData.rubro}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Condición Fiscal:</span>
                <span className="text-sm font-bold text-gray-900">{formData.condicionFiscal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Escala:</span>
                <span className="text-sm font-bold text-gray-900">{formData.numLocales} local(es)</span>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <p className="text-xs text-blue-800 m-0">
                💡 <strong>Tip:</strong> Podrás cambiar estos datos y agregar más locales en cualquier momento desde la configuración.
              </p>
            </div>
          </div>
        )}

        {/* PASO 4: INVITAR EQUIPO (OPCIONAL) */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">¿Querés invitar a tu equipo ahora?</h3>
              <p className="text-sm text-gray-600">
                Podés agregar cajeros o empleados que necesiten acceso al sistema. 
                <strong> Esto es opcional</strong>, podés hacerlo después desde el dashboard.
              </p>
            </div>

            {/* Opción de saltar */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setSkipTeamInvite(true); handleFinish(); }}
                className="flex-1 p-3 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Saltar, lo hago después
              </button>
              <button
                type="button"
                onClick={() => setSkipTeamInvite(false)}
                className={`flex-1 p-3 border-none rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                  !skipTeamInvite ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Agregar ahora
              </button>
            </div>

            {!skipTeamInvite && (
              <>
                {/* Formulario para agregar invitación */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="mb-3">
                    <label className="block mb-2 font-semibold text-gray-700 text-sm">Email del usuario</label>
                    <input
                      type="email"
                      value={newInviteEmail}
                      onChange={e => setNewInviteEmail(e.target.value)}
                      placeholder="usuario@ejemplo.com"
                      className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block mb-2 font-semibold text-gray-700 text-sm">Rol</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(ROLES_INFO).map(([key, info]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setNewInviteRole(key)}
                          className={`p-3 rounded-lg border-2 text-left cursor-pointer transition-all ${
                            newInviteRole === key 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{info.icono}</span>
                            <span className="font-bold text-sm text-gray-900">{info.titulo}</span>
                          </div>
                          <div className="text-xs text-gray-600">{info.descripcion}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addInvite}
                    className="w-full p-3 bg-emerald-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-emerald-600 transition-colors"
                  >
                    + Agregar a la lista
                  </button>
                </div>

                {/* Info detallada de roles (expandible) */}
                <div className="space-y-2">
                  {Object.entries(ROLES_INFO).map(([key, info]) => (
                    <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowRoleInfo(showRoleInfo === key ? null : key)}
                        className="w-full p-3 bg-white text-left cursor-pointer hover:bg-gray-50 flex justify-between items-center"
                      >
                        <span className="text-sm font-semibold text-gray-700">
                          {info.icono} ¿Qué puede hacer un {info.titulo.toLowerCase()}?
                        </span>
                        <span className="text-gray-400">{showRoleInfo === key ? '▼' : '▶'}</span>
                      </button>
                      {showRoleInfo === key && (
                        <div className="p-3 bg-gray-50 border-t border-gray-200">
                          <div className="mb-2">
                            <div className="text-xs font-semibold text-green-700 mb-1">✅ Puede:</div>
                            <ul className="text-xs text-gray-700 space-y-1 ml-4">
                              {info.puede.map((item, i) => <li key={i}>• {item}</li>)}
                            </ul>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-red-700 mb-1">❌ No puede:</div>
                            <ul className="text-xs text-gray-700 space-y-1 ml-4">
                              {info.noPuede.map((item, i) => <li key={i}>• {item}</li>)}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Lista de invitaciones agregadas */}
                {invites.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <div className="text-sm font-bold text-blue-900 mb-2">
                      📧 {invites.length} usuario{invites.length > 1 ? 's' : ''} para invitar:
                    </div>
                    <div className="space-y-2">
                      {invites.map((inv, index) => (
                        <div key={index} className="flex justify-between items-center bg-white p-2 rounded-md">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{ROLES_INFO[inv.rol].icono}</span>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{inv.email}</div>
                              <div className="text-xs text-gray-500">{ROLES_INFO[inv.rol].titulo}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeInvite(index)}
                            className="text-red-500 hover:text-red-700 bg-none border-none cursor-pointer text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* FOOTER / BOTONES */}
        <div className="mt-8 flex gap-3">
          {step > 1 && step < 4 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 p-3 bg-gray-100 text-gray-700 border-none rounded-lg font-semibold cursor-pointer hover:bg-gray-200"
            >
              Atrás
            </button>
          )}
          
          {step < 3 ? (
            <button
              onClick={handleNext}
              className="flex-1 p-3 bg-blue-500 text-white border-none rounded-lg font-bold cursor-pointer hover:bg-blue-600"
            >
              Continuar
            </button>
          ) : step === 3 ? (
            <button
              onClick={() => setStep(4)}
              className="flex-1 p-3 bg-blue-500 text-white border-none rounded-lg font-bold cursor-pointer hover:bg-blue-600"
            >
              Siguiente: Equipo
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="flex-1 p-3 bg-green-600 text-white border-none rounded-lg font-bold cursor-pointer hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Configurando...' : '¡Empezar a usar GDT!'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
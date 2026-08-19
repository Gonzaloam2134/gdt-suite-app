import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import toast from 'react-hot-toast'

const TIPOS_CONSULTA = [
  { id: 'soporte', label: '🔧 Soporte técnico', desc: 'Reportar un error o bug' },
  { id: 'consulta', label: '❓ Consulta general', desc: 'Dudas sobre el uso' },
  { id: 'feature', label: ' Solicitud de función', desc: 'Proponer una mejora' },
  { id: 'facturacion', label: '💰 Facturación', desc: 'Problemas con pagos o suscripción' },
  { id: 'otro', label: ' Otro', desc: 'Cualquier otra consulta' }
]

export default function ContactModal({ isOpen, onClose, user, localId, paginaOrigen }) {
  const [tipo, setTipo] = useState('soporte')
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTipo('soporte')
      setAsunto('')
      setMensaje('')
      setEnviado(false)
    }
  }, [isOpen])

  const handleEnviar = async () => {
    if (!asunto.trim() || !mensaje.trim()) {
      toast.error('Completá el asunto y el mensaje')
      return
    }

    try {
      setEnviando(true)

      const { error } = await supabase.from('contactos').insert([{
        user_id: user?.id,
        local_id: localId || null,
        tipo_consulta: tipo,
        asunto: asunto.trim(),
        mensaje: mensaje.trim(),
        pagina_origen: paginaOrigen || 'desconocida',
        estado: 'pendiente'
      }])

      if (error) throw error

      setEnviado(true)
      toast.success('✅ Consulta enviada correctamente')
      
      setTimeout(() => {
        onClose()
      }, 2000)

    } catch (err) {
      console.error('Error enviando contacto:', err)
      toast.error('Error al enviar: ' + err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-50 p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900"> Contacto y Soporte</h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl cursor-pointer bg-none border-none"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Te respondemos en menos de 24 horas hábiles.
          </p>
        </div>

        {/* Contenido */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {enviado ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">¡Consulta enviada!</h3>
              <p className="text-sm text-gray-600">
                Recibimos tu mensaje. Te contactaremos pronto a <strong>{user?.email}</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Info del usuario */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <div className="text-xs text-blue-700 font-semibold mb-1">Tus datos (auto-detectados):</div>
                <div className="text-blue-900">👤 {user?.email}</div>
                {localId && <div className="text-blue-900">🏪 Local ID: {localId.substring(0, 8)}...</div>}
                {paginaOrigen && <div className="text-blue-900">📍 Desde: {paginaOrigen}</div>}
              </div>

              {/* Tipo de consulta */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de consulta *</label>
                <div className="space-y-2">
                  {TIPOS_CONSULTA.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTipo(t.id)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        tipo === t.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold text-gray-900 text-sm">{t.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Asunto */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Asunto *</label>
                <input
                  type="text"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ej: Error al exportar reporte de marzo"
                  maxLength={100}
                />
                <div className="text-xs text-gray-500 mt-1 text-right">{asunto.length}/100</div>
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mensaje *</label>
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-vertical"
                  placeholder="Describí tu consulta con el mayor detalle posible..."
                  rows={5}
                  maxLength={2000}
                />
                <div className="text-xs text-gray-500 mt-1 text-right">{mensaje.length}/2000</div>
              </div>

              {/* Aviso de privacidad */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
                ℹ️ Tu información es confidencial y solo será utilizada para responder tu consulta.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!enviado && (
          <div className="p-6 bg-slate-50 border-t border-gray-200 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 p-3 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleEnviar}
              disabled={enviando || !asunto.trim() || !mensaje.trim()}
              className="flex-1 p-3 bg-blue-600 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enviando ? 'Enviando...' : '📤 Enviar consulta'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

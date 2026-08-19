import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import toast from 'react-hot-toast'

export default function ReversaModal({ isOpen, onClose, transaccion, onReversaExitosa }) {
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen || !transaccion) return null

  const handleReversa = async () => {
    if (!motivo.trim()) {
      toast.error('Debes indicar el motivo de la reversa')
      return
    }

    setLoading(true)
    try {
      // Crear la transacción reversa (montos negativos)
      const reversaPayload = {
        local_id: transaccion.local_id,
        tipo: transaccion.tipo, // COBRO_RECIBIDO o GASTO_REGISTRADO
        medio_pago_id: transaccion.medio_pago_id,
        monto: -(transaccion.monto || 0), // Monto negativo
        monto_neto: -(transaccion.monto_neto || 0),
        monto_iva: -(transaccion.monto_iva || 0),
        descripcion: `[REVERSA] ${transaccion.descripcion || 'Transacción'} - Motivo: ${motivo}`,
        es_reversa: true,
        reversa_de: transaccion.id,
        motivo_reversa: motivo.trim(),
        creado_por: (await supabase.auth.getSession()).data.session?.user?.id
      }

      const { error } = await supabase.from('transacciones').insert([reversaPayload])
      
      if (error) throw error
      
      toast.success('✅ Reversa contable registrada correctamente')
      setMotivo('')
      onReversaExitosa()
      onClose()
    } catch (err) {
      console.error('Error al crear reversa:', err)
      toast.error('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-amber-500 p-5 text-white">
          <h2 className="text-lg font-bold m-0">↩️ Reversa Contable</h2>
          <p className="text-sm text-amber-100 mt-1 m-0">Esta acción no borra la transacción original</p>
        </div>

        {/* Contenido */}
        <div className="p-5 space-y-4">
          {/* Info de la transacción original */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="text-xs font-bold text-gray-700 mb-2">Transacción a reversar:</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Tipo:</span>
                <span className="font-semibold">{transaccion.tipo === 'COBRO_RECIBIDO' ? 'Cobro' : 'Gasto'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Monto:</span>
                <span className="font-bold text-gray-900">${transaccion.monto?.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha:</span>
                <span>{new Date(transaccion.creado_en).toLocaleDateString('es-AR')}</span>
              </div>
              {transaccion.descripcion && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Descripción:</span>
                  <span className="text-right">{transaccion.descripcion}</span>
                </div>
              )}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Motivo de la reversa: <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Error en el monto, cliente solicitó devolución, etc."
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-vertical"
            />
            <p className="text-xs text-gray-500 mt-1">
              Este motivo quedará registrado en el historial contable.
            </p>
          </div>

          {/* Advertencia */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
            <p className="text-xs text-amber-900 m-0">
              <strong>⚠️ Importante:</strong> Se creará una nueva transacción con montos negativos que anulará la original. Ambas quedarán registradas para auditoría.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-gray-50 border-t border-gray-200 flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-300 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleReversa}
            disabled={loading || !motivo.trim()}
            className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : '↩️ Confirmar Reversa'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import toast from 'react-hot-toast'

export default function GastoModal({ isOpen, onClose, localId, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [mediosPago, setMediosPago] = useState([])
  const [medioSeleccionado, setMedioSeleccionado] = useState('')
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')

  useEffect(() => {
    if (isOpen && localId) {
      cargarMediosPago()
    }
  }, [isOpen, localId])

  const cargarMediosPago = async () => {
    try {
      const { data } = await supabase
        .from('medios_pago')
        .select('*')
        .eq('local_id', localId)
        .eq('habilitado', true)
        .order('orden', { ascending: true })
      
      setMediosPago(data || [])
      if (data && data.length > 0) {
        setMedioSeleccionado(data[0].id)
      }
    } catch (err) {
      console.error('Error cargando medios de pago:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!medioSeleccionado) {
      toast.error('Seleccioná un medio de pago')
      return
    }
    
    if (!monto || parseFloat(monto) <= 0) {
      toast.error('Ingresá un monto válido')
      return
    }

    try {
      setLoading(true)
      
      const fechaCreado = new Date()
      
      const { error } = await supabase.from('transacciones').insert([{
        local_id: localId,
        tipo: 'GASTO_REGISTRADO',
        medio_pago_id: medioSeleccionado,
        monto: parseFloat(monto),
        monto_neto: parseFloat(monto) / 1.21, // Asumiendo 21% IVA
        monto_iva: parseFloat(monto) - (parseFloat(monto) / 1.21),
        descripcion: descripcion || 'Gasto',
        creado_en: fechaCreado.toISOString(),
        es_reversa: false
      }])
      
      if (error) throw error
      
      toast.success('✅ Gasto registrado correctamente')
      resetForm()
      onSuccess()
    } catch (err) {
      console.error('Error registrando gasto:', err)
      toast.error('Error al registrar gasto: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setMonto('')
    setDescripcion('')
    if (mediosPago.length > 0) {
      setMedioSeleccionado(mediosPago[0].id)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-red-600 p-4 text-white">
          <h2 className="text-lg font-bold m-0"> Registrar Gasto</h2>
          <p className="text-xs text-white/80 m-0 mt-1">Ingresá los datos del gasto realizado</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Medio de Pago */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Medio de Pago *
            </label>
            <select
              value={medioSeleccionado}
              onChange={(e) => setMedioSeleccionado(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white"
              required
            >
              {mediosPago.map(medio => (
                <option key={medio.id} value={medio.id}>
                  {medio.icono} {medio.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Monto *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Descripción *
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Alquiler, Luz, Insumos, etc."
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
              required
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                resetForm()
                onClose()
              }}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-red-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Registrando...' : '💸 Registrar Gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

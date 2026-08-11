import { useState } from 'react'

export default function ExportModal({ onClose, onExport, loading }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleSubmit = () => {
    if (!startDate || !endDate) {
      alert('⚠️ Seleccioná fecha de inicio y fin')
      return
    }
    onExport(startDate, endDate)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">📊 Exportar a Excel</h2>
        <p className="text-sm text-gray-600 mb-4">
          Seleccioná el período a exportar:
        </p>

        <div className="mb-4">
          <label className="block mb-2 font-semibold text-sm">Desde:</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg text-base box-border"
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 font-semibold text-sm">Hasta:</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg text-base box-border"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 p-3 bg-gray-100 border border-gray-200 rounded-lg font-semibold cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 p-3 bg-emerald-500 text-white border-none rounded-lg font-bold cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Exportando...' : 'Exportar'}
          </button>
        </div>
      </div>
    </div>
  )
}
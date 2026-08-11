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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '400px', borderRadius: '12px', padding: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '700' }}>📊 Exportar a Excel</h2>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#64748b' }}>Seleccioná el período a exportar:</p>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Desde:</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Hasta:</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', opacity: loading ? 0.6 : 1 }}>{loading ? 'Exportando...' : 'Exportar'}</button>
        </div>
      </div>
    </div>
  )
}

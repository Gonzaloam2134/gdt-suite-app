import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

export default function Reportes() {
  const router = useRouter()

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderBottom: '2px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: '800' }}> Reportes</h1>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>Próximamente</p>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}></div>
        <h2 style={{ color: '#0f172a', marginBottom: '1rem' }}>Módulo en construcción</h2>
        <p style={{ color: '#64748b', marginBottom: '2rem' }}>
          Acá vas a poder ver reportes de ventas, gastos, medios de pago más usados, y mucho más.
        </p>
        <button 
          onClick={() => router.push('/dashboard')}
          style={{ padding: '1rem 2rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}
        >
          Volver a la Caja
        </button>
      </div>

      <BottomNav activeTab="reportes" />
    </main>
  )
}

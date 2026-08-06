import { useRouter } from 'next/router'

export default function BottomNav({ activeTab }) {
  const router = useRouter()

  const tabs = [
    { id: 'caja', label: 'Caja', icon: '💰', path: '/dashboard' },
    { id: 'equipo', label: 'Equipo', icon: '', path: '/equipo' },
    { id: 'reportes', label: 'Reportes', icon: '📊', path: '/reportes' },
    { id: 'config', label: 'Ajustes', icon: '️', path: '/configuracion' }
  ]

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#ffffff',
      borderTop: '1px solid #e2e8f0',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '0.5rem 0',
      zIndex: 40
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id || router.pathname === tab.path
        return (
          <button
            key={tab.id}
            onClick={() => router.push(tab.path)}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
              cursor: 'pointer',
              color: isActive ? '#2563eb' : '#64748b',
              fontWeight: isActive ? '700' : '500',
              fontSize: '0.7rem',
              padding: '0.25rem 0.5rem'
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

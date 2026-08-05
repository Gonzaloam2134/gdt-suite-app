import { useRouter } from 'next/router'

export default function BottomNav({ activeTab }) {
  const router = useRouter()

  const tabs = [
    { id: 'caja', label: 'Caja', icon: '🏠', path: '/dashboard' },
    { id: 'reportes', label: 'Reportes', icon: '📊', path: '/reportes' },
    { id: 'config', label: 'Config', icon: '⚙️', path: '/configuracion' },
    { id: 'cuenta', label: 'Cuenta', icon: '👤', path: '/cuenta' }
  ]

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#ffffff',
      borderTop: '2px solid #e2e8f0',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '0.75rem 0',
      zIndex: 100,
      boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)'
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => router.push(tab.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              transition: 'all 0.2s',
              backgroundColor: isActive ? '#f1f5f9' : 'transparent'
            }}
          >
            <span style={{ fontSize: '1.5rem', filter: isActive ? 'none' : 'grayscale(100%)' }}>
              {tab.icon}
            </span>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: isActive ? '800' : '500',
              color: isActive ? '#0f172a' : '#64748b'
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

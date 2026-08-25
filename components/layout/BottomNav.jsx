import { useRouter } from 'next/router'
import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES } from '../../lib/constants/roles'

/**
 * Navegación inferior, solo mobile. Un único componente para toda la app.
 * Admin se oculta para cajero/empleado. Super user ve todo.
 */
const TABS = [
  { id: 'caja',     label: 'Caja',     icon: '💰', path: '/dashboard' },
  { id: 'reportes', label: 'Reportes', icon: '📊', path: '/reportes' },
  { id: 'admin',    label: 'Admin',    icon: '⚙️', path: '/admin', roles: [ROLES.OWNER] },
  { id: 'locales',  label: 'Locales',  icon: '🏪', path: '/locales' },
]

export default function BottomNav({ activeTab }) {
  const router = useRouter()
  const { hasRole } = useUserRole()
  const tabs = TABS.filter(t => !t.roles || hasRole(t.roles))

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 shadow-lg" aria-label="Navegación principal">
      <div className="flex">
        {tabs.map(tab => {
          const activa = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => router.push(tab.path)} aria-current={activa ? 'page' : undefined}
              className={`flex-1 py-2 flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer transition-colors ${activa ? 'text-blue-600' : 'text-gray-500'}`}>
              <span className="text-xl">{tab.icon}</span>
              <span className={`text-[11px] ${activa ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

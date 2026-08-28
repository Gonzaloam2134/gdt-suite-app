import { useRouter } from 'next/router'
import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES } from '../../lib/constants/roles'

/**
 * Navegación inferior, solo mobile. Presente en todas las pantallas, incluida
 * la de inicio: si aparece y desaparece según dónde estés, se pierde la referencia.
 * Caja y Admin necesitan un local activo; sin él llevan a elegir uno.
 */
const TABS = [
  { id: 'inicio',   label: 'Inicio',   icon: '🏪', path: '/locales' },
  { id: 'caja',     label: 'Caja',     icon: '💰', path: '/dashboard', requiereLocal: true },
  { id: 'reportes', label: 'Reportes', icon: '📊', path: '/reportes' },
  { id: 'admin',    label: 'Admin',    icon: '⚙️', path: '/admin', roles: [ROLES.OWNER], requiereLocal: true },
]

export default function BottomNav({ activeTab }) {
  const router = useRouter()
  const { hasRole, activeLocalId } = useUserRole()
  const tabs = TABS.filter(t => !t.roles || hasRole(t.roles))

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 shadow-lg" aria-label="Navegación principal">
      <div className="flex">
        {tabs.map(tab => {
          const activa = activeTab === tab.id
          return (
            <button key={tab.id} aria-current={activa ? 'page' : undefined}
              onClick={() => router.push(tab.requiereLocal && !activeLocalId ? '/locales' : tab.path)}
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

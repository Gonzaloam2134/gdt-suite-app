import { useRouter } from 'next/router'
import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES } from '../../lib/constants/roles'

/**
 * Navegación principal. Presente en todas las pantallas, incluida la de
 * inicio: si aparece y desaparece según dónde estés, se pierde la referencia.
 * Caja y Admin necesitan un local activo; sin él llevan a elegir uno.
 *
 * Mobile: barra inferior translúcida. Con `lateral`, desde md se reemplaza
 * por una nav lateral fija (la página tiene que dejar `md:pl-56`). Sin
 * `lateral` (pantallas aún no rediseñadas) sigue siendo solo mobile y el
 * desktop usa la nav del AppHeader.
 */
const TABS = [
  { id: 'inicio',   label: 'Inicio',   icon: '🏪', path: '/locales' },
  { id: 'caja',     label: 'Caja',     icon: '💰', path: '/dashboard', requiereLocal: true },
  { id: 'reportes', label: 'Reportes', icon: '📊', path: '/reportes' },
  { id: 'admin',    label: 'Admin',    icon: '⚙️', path: '/admin', roles: [ROLES.OWNER], requiereLocal: true },
]

export default function BottomNav({ activeTab, lateral = false }) {
  const router = useRouter()
  const { hasRole, activeLocalId } = useUserRole()
  const tabs = TABS.filter(t => !t.roles || hasRole(t.roles))
  const ir = (tab) => router.push(tab.requiereLocal && !activeLocalId ? '/locales' : tab.path)

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-xl border-t border-black/5 pb-[env(safe-area-inset-bottom)]" aria-label="Navegación principal">
        <div className="flex">
          {tabs.map(tab => {
            const activa = activeTab === tab.id
            return (
              <button key={tab.id} aria-current={activa ? 'page' : undefined} onClick={() => ir(tab)}
                className={`press flex-1 min-h-[52px] py-2 flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer ${activa ? 'text-primary-600' : 'text-gray-500'}`}>
                <span className="text-xl leading-none">{tab.icon}</span>
                <span className={`text-[11px] ${activa ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {lateral && (
        <nav className="hidden md:flex fixed top-0 bottom-0 left-0 w-56 z-30 flex-col gap-1 p-3 pt-5 bg-white border-r border-black/5" aria-label="Navegación principal">
          <p className="m-0 mb-3 px-3 text-base font-extrabold text-primary-700 tracking-tight">GDT Suite</p>
          {tabs.map(tab => {
            const activa = activeTab === tab.id
            return (
              <button key={tab.id} aria-current={activa ? 'page' : undefined} onClick={() => ir(tab)}
                className={`press flex items-center gap-3 px-3 py-2.5 rounded-[14px] border-none cursor-pointer text-left text-sm transition-colors ${
                  activa ? 'bg-primary-50 text-primary-700 font-bold' : 'bg-transparent text-gray-600 font-medium hover:bg-gray-100'}`}>
                <span className="text-lg leading-none">{tab.icon}</span>{tab.label}
              </button>
            )
          })}
        </nav>
      )}
    </>
  )
}

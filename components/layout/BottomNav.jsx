import { useRouter } from 'next/router'
import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES } from '../../lib/constants/roles'
import MasMenu from './MasMenu'
import Icono from '../ui/Icono'

/**
 * Navegación por rol: lo frecuente a la vista, el resto en "Más".
 * - Empleado: Cobrar (+ Inicio solo si tiene varios locales).
 * - Cajero: Caja.
 * - Dueño: Caja y Reportes.
 * Con un solo local no hay "Inicio": no hay nada que elegir, se entra directo a la caja.
 * `cantidadLocales` lo pasa cada página (ya tiene la lista); sin ese dato se muestra Inicio.
 */
const TABS = [
  { id: 'inicio', label: 'Inicio', icono: 'inicio', path: '/locales' },
  { id: 'caja', label: 'Caja', icono: 'caja', path: '/dashboard', requiereLocal: true },
  { id: 'reportes', label: 'Reportes', icono: 'reportes', path: '/reportes', roles: [ROLES.OWNER] },
]

// Solo para super_user (rol_global, independiente del rol por local): va
// primero porque es lo que usa todos los días. Inicio/Caja quedan debajo
// por si el super admin también es dueño/cajero de algún local propio.
const TAB_PANEL_GLOBAL = { id: 'panel-global', label: 'Panel Global', icono: 'corona', path: '/superadmin' }

export default function BottomNav({ activeTab, lateral = false, cantidadLocales }) {
  const router = useRouter()
  const { hasRole, role, activeLocalId, esSuperUser } = useUserRole()
  const unSoloLocal = cantidadLocales === 1
  const tabs = [
    ...(esSuperUser ? [TAB_PANEL_GLOBAL] : []),
    ...TABS
      .filter(t => !t.roles || hasRole(t.roles))
      .filter(t => !(t.id === 'inicio' && unSoloLocal))
      .map(t => (t.id === 'caja' && role === ROLES.EMPLEADO ? { ...t, label: 'Cobrar' } : t)),
  ]
  const ir = (tab) => router.push(tab.requiereLocal && !activeLocalId ? '/locales' : tab.path)

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-xl border-t border-black/5 pb-[env(safe-area-inset-bottom)]" aria-label="Navegación principal">
        <div className="flex">
          {tabs.map(tab => {
            const activa = activeTab === tab.id
            return (
              <button key={tab.id} aria-current={activa ? 'page' : undefined} onClick={() => ir(tab)}
                className={`press flex-1 min-h-[52px] py-2 flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer ${activa ? 'text-primary-600' : 'text-gray-500'}`}>
                <Icono nombre={tab.icono} size={24} />
                <span className={`text-[11px] ${activa ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
              </button>
            )
          })}
          <MasMenu activeTab={activeTab} unSoloLocal={unSoloLocal} />
        </div>
      </nav>

      {lateral && (
        <nav className="hidden md:flex fixed top-0 bottom-0 left-0 w-56 z-30 flex-col gap-1 p-3 pt-5 bg-white border-r border-black/5" aria-label="Navegación principal">
          <div className="mb-3 px-3 flex items-center gap-2">
            <img src="/logo-mark.svg" width="22" height="22" alt="" />
            <span className="text-base font-extrabold text-primary-700 tracking-tight">GDT Suite</span>
          </div>
          {tabs.map(tab => {
            const activa = activeTab === tab.id
            return (
              <button key={tab.id} aria-current={activa ? 'page' : undefined} onClick={() => ir(tab)}
                className={`press flex items-center gap-3 px-3 py-2.5 rounded-[14px] border-none cursor-pointer text-left text-sm transition-colors ${activa ? 'bg-primary-50 text-primary-700 font-bold' : 'bg-transparent text-gray-600 font-medium hover:bg-gray-100'}`}>
                <Icono nombre={tab.icono} size={22} />{tab.label}
              </button>
            )
          })}
          <MasMenu lateral activeTab={activeTab} unSoloLocal={unSoloLocal} />
        </nav>
      )}
    </>
  )
}

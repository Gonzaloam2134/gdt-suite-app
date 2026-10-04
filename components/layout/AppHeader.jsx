import { useRouter } from 'next/router'
import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES } from '../../lib/constants/roles'
import SelectorLocal from './SelectorLocal'

/**
 * Cabecera común: título de la pantalla, selector de local siempre a mano
 * y accesos a las secciones. Una sola definición para toda la app. Las
 * acciones de sesión (instalar, novedades, cerrar sesión) viven en la barra
 * lateral (MenuSesion), no acá.
 */
export default function AppHeader({ titulo, subtitulo, locales = [], localId, onCambiarLocal, permiteTodos, acciones, ocultarNavDesktop = false, sinLocal = false }) {
  const router = useRouter()
  const { hasRole } = useUserRole()

  const ir = (path) => router.push(path)

  return (
    <header className="bg-fondo/90 backdrop-blur-md border-b border-black/5 sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {sinLocal ? (
            <h1 className="m-0 text-base font-bold text-gray-900 truncate">{titulo}</h1>
          ) : (
            <>
              <SelectorLocal locales={locales} localId={localId} onCambiar={onCambiarLocal} permiteTodos={permiteTodos} />
              <div className="hidden md:block min-w-0 border-l border-gray-200 pl-3">
                <h1 className="m-0 text-sm font-bold text-gray-900 truncate">{titulo}</h1>
                {subtitulo && <p className="mt-0 text-xs text-gray-500 truncate m-0">{subtitulo}</p>}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {acciones}

          {/* En desktop no hay barra inferior, así que los accesos van acá */}
          <nav className={`${ocultarNavDesktop ? 'hidden' : 'hidden md:flex'} items-center gap-1`}>
            <BotonNav onClick={() => ir('/dashboard')} activo={router.pathname === '/dashboard'}>Caja</BotonNav>
            <BotonNav onClick={() => ir('/reportes')} activo={router.pathname === '/reportes'}>Reportes</BotonNav>
            {hasRole([ROLES.OWNER]) && (
              <BotonNav onClick={() => ir('/admin')} activo={router.pathname === '/admin'}>Admin</BotonNav>
            )}
            <BotonNav onClick={() => ir('/locales')} activo={router.pathname === '/locales'}>Mis locales</BotonNav>
          </nav>

        </div>
      </div>

      {/* En mobile el título va debajo, porque arriba manda el selector de local */}
      {!sinLocal && <div className="md:hidden px-3 pb-2">
        <h1 className="m-0 text-xs font-semibold text-gray-500 truncate">{titulo}{subtitulo ? ` · ${subtitulo}` : ''}</h1>
      </div>}
    </header>
  )
}

const BotonNav = ({ children, onClick, activo }) => (
  <button onClick={onClick}
    className={`px-3 py-1.5 border-none rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
      activo ? 'bg-primary-50 text-primary-700' : 'bg-transparent text-gray-600 hover:bg-gray-100'}`}>
    {children}
  </button>
)


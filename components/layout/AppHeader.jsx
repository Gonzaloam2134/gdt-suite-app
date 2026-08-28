import { useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { useUserRole } from '../../lib/UserRoleContext'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useSignOut } from '../../hooks/useSignOut'
import { ROLES } from '../../lib/constants/roles'
import SelectorLocal from './SelectorLocal'
import GuiaInstalacionModal from './GuiaInstalacionModal'

/**
 * Cabecera común: título de la pantalla, selector de local siempre a mano
 * y menú con el resto de las secciones. Una sola definición para toda la app.
 */
export default function AppHeader({ titulo, subtitulo, locales = [], localId, onCambiarLocal, permiteTodos, acciones }) {
  const router = useRouter()
  const signOut = useSignOut()
  const { hasRole, esSuperUser } = useUserRole()
  const [menu, setMenu] = useState(false)
  const [guiaInstalacion, setGuiaInstalacion] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setMenu(false), menu)

  const ir = (path) => { setMenu(false); router.push(path) }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <SelectorLocal locales={locales} localId={localId} onCambiar={onCambiarLocal} permiteTodos={permiteTodos} />
          <div className="hidden md:block min-w-0 border-l border-gray-200 pl-3">
            <h1 className="m-0 text-sm font-bold text-gray-900 truncate">{titulo}</h1>
            {subtitulo && <p className="mt-0 text-xs text-gray-500 truncate m-0">{subtitulo}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {acciones}

          {/* En desktop no hay barra inferior, así que los accesos van acá */}
          <nav className="hidden md:flex items-center gap-1">
            <BotonNav onClick={() => ir('/dashboard')} activo={router.pathname === '/dashboard'}>Caja</BotonNav>
            <BotonNav onClick={() => ir('/reportes')} activo={router.pathname === '/reportes'}>Reportes</BotonNav>
            {hasRole([ROLES.OWNER]) && (
              <BotonNav onClick={() => ir('/admin')} activo={router.pathname === '/admin'}>Admin</BotonNav>
            )}
            <BotonNav onClick={() => ir('/locales')} activo={router.pathname === '/locales'}>Mis locales</BotonNav>
          </nav>

          <div className="relative" ref={ref}>
            <button onClick={() => setMenu(o => !o)} aria-label="Menú" aria-expanded={menu}
              className="p-2 bg-gray-100 text-gray-600 border-none rounded-lg cursor-pointer hover:bg-gray-200 leading-none">☰</button>
            {menu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-50">
                <ItemMenu onClick={() => { setMenu(false); setGuiaInstalacion(true) }}>📲 Instalar app</ItemMenu>
                <ItemMenu onClick={() => ir('/anuncios')}>Novedades</ItemMenu>
                {esSuperUser && <ItemMenu onClick={() => ir('/superadmin')}>Panel global</ItemMenu>}
                <hr className="my-1 border-gray-200" />
                <ItemMenu onClick={signOut} peligro>Cerrar sesión</ItemMenu>
              </div>
            )}
          </div>
        </div>
      </div>

      <GuiaInstalacionModal isOpen={guiaInstalacion} onClose={() => setGuiaInstalacion(false)} />

      {/* En mobile el título va debajo, porque arriba manda el selector de local */}
      <div className="md:hidden px-3 pb-2">
        <h1 className="m-0 text-xs font-semibold text-gray-500 truncate">{titulo}{subtitulo ? ` · ${subtitulo}` : ''}</h1>
      </div>
    </header>
  )
}

const BotonNav = ({ children, onClick, activo }) => (
  <button onClick={onClick}
    className={`px-3 py-1.5 border-none rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
      activo ? 'bg-blue-50 text-blue-700' : 'bg-transparent text-gray-600 hover:bg-gray-100'}`}>
    {children}
  </button>
)

const ItemMenu = ({ children, onClick, peligro }) => (
  <button onClick={onClick}
    className={`w-full px-4 py-2.5 text-left text-sm bg-transparent border-none cursor-pointer hover:bg-gray-50 ${
      peligro ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'}`}>
    {children}
  </button>
)

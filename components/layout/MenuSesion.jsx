import { useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { useUserRole } from '../../lib/UserRoleContext'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useSignOut } from '../../hooks/useSignOut'
import Icono from '../ui/Icono'
import GuiaInstalacionModal from './GuiaInstalacionModal'

/**
 * Bloque de sesión: email de la persona + Instalar app, Novedades y Cerrar
 * sesión (y Panel global para el super admin). Vive al pie de la barra
 * lateral (`desplegable`: el menú se abre hacia arriba, desde su botón) y,
 * en mobile, que no tiene barra lateral, como lista dentro de Mi cuenta.
 */
export default function MenuSesion({ desplegable = false }) {
  const router = useRouter()
  const signOut = useSignOut()
  const { perfil, esSuperUser } = useUserRole()
  const [abierto, setAbierto] = useState(false)
  const [guia, setGuia] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setAbierto(false), abierto)

  const email = perfil?.email || ''
  const inicial = (perfil?.nombre || email || '?').trim().charAt(0).toUpperCase()
  const ir = (path) => { setAbierto(false); router.push(path) }

  const items = (
    <>
      <Item icono="instalar" onClick={() => { setAbierto(false); setGuia(true) }}>Instalar app</Item>
      <Item icono="novedades" onClick={() => ir('/anuncios')}>Novedades</Item>
      {esSuperUser && <Item icono="global" onClick={() => ir('/superadmin')}>Panel global</Item>}
      <hr className="my-1 border-0 border-t border-gray-100" />
      <Item icono="salir" onClick={signOut} peligro>Cerrar sesión</Item>
    </>
  )

  return (
    <div ref={ref} className={desplegable ? 'relative' : 'bg-white rounded-[20px] border border-black/5 shadow-suave p-2'}>
      {desplegable ? (
        <>
          {abierto && (
            <div role="menu" className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-[16px] border border-black/5 shadow-suave p-1.5 animate-pop-in origin-bottom">
              {items}
            </div>
          )}
          <button onClick={() => setAbierto(o => !o)} aria-expanded={abierto} aria-haspopup="menu"
            className="press w-full flex items-center gap-2.5 p-2 rounded-[14px] border-none bg-transparent hover:bg-gray-100 cursor-pointer text-left">
            <Avatar inicial={inicial} />
            <span className="flex-1 min-w-0 text-xs font-semibold text-gray-700 truncate">{email || 'Mi sesión'}</span>
            <span className="text-gray-400 text-xs" aria-hidden="true">{abierto ? '▾' : '▴'}</span>
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2.5 p-2 pb-1">
            <Avatar inicial={inicial} />
            <span className="min-w-0 text-sm font-semibold text-gray-700 truncate">{email || 'Mi sesión'}</span>
          </div>
          {items}
        </>
      )}
      <GuiaInstalacionModal isOpen={guia} onClose={() => setGuia(false)} />
    </div>
  )
}

const Avatar = ({ inicial }) => (
  <span className="w-8 h-8 shrink-0 rounded-full bg-primary-50 text-primary-700 text-sm font-bold flex items-center justify-center">{inicial}</span>
)

const Item = ({ children, onClick, peligro, icono }) => (
  <button role="menuitem" onClick={onClick}
    className={`press w-full px-3 py-2.5 flex items-center gap-2.5 text-left text-sm rounded-[12px] bg-transparent border-none cursor-pointer min-h-[44px] md:min-h-0 ${
      peligro ? 'text-danger-700 hover:bg-danger-50' : 'text-gray-700 hover:bg-gray-100'}`}>
    {icono && <Icono nombre={icono} size={18} />}{children}
  </button>
)

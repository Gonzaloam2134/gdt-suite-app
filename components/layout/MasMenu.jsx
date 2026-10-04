import { useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { useUserRole } from '../../lib/UserRoleContext'
import { ROLES } from '../../lib/constants/roles'
import { useClickOutside } from '../../hooks/useClickOutside'
import Icono from '../ui/Icono'
import MenuSesion from './MenuSesion'

/**
 * Menú secundario: la navegación principal queda reservada para las tareas
 * frecuentes. Configuración, cuenta y recursos viven acá para no competir con
 * Cobrar/Caja/Reportes.
 */
export default function MasMenu({ lateral = false, activeTab, unSoloLocal = false }) {
  const router = useRouter()
  const { hasRole } = useUserRole()
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setAbierto(false), abierto)

  const secundarioActivo = ['admin', 'mi-cuenta', 'planes', 'anuncios'].includes(activeTab)

  // Lo ocasional, y solo lo que le sirve a cada rol: cajero y empleado no tienen
  // configuración, plan ni cuenta que administrar (solo Novedades y su sesión).
  const esDueno = hasRole([ROLES.OWNER])
  const items = [
    esDueno && { label: 'Configuración', icono: 'admin', path: '/admin' },
    esDueno && unSoloLocal && { label: 'Mis locales', icono: 'inicio', path: '/locales?ver=1' },
    esDueno && { label: 'Mi cuenta', icono: 'cuenta', path: '/mi-cuenta' },
    esDueno && { label: 'Planes', icono: 'tarjeta', path: '/planes' },
    { label: 'Novedades', icono: 'novedades', path: '/anuncios' },
  ].filter(Boolean)

  const ir = (path) => {
    setAbierto(false)
    router.push(path)
  }

  if (lateral) {
    return (
      <div className="mt-auto pt-3 border-t border-black/5" ref={ref}>
        <button
          type="button"
          onClick={() => setAbierto(v => !v)}
          aria-expanded={abierto}
          aria-haspopup="menu"
          className="press w-full flex items-center gap-3 px-3 py-2.5 rounded-[14px] border-none cursor-pointer text-left text-sm font-medium text-gray-600 bg-transparent hover:bg-gray-100"
        >
          <Icono nombre="admin" size={22} />
          Más
        </button>
        {abierto && (
          <div role="menu" className="mt-1 bg-white rounded-[16px] border border-black/5 shadow-suave p-1.5">
            {items.map(item => (
              <button key={item.path} role="menuitem" onClick={() => ir(item.path)}
                className="press w-full px-3 py-2.5 flex items-center gap-2.5 text-left text-sm rounded-[12px] bg-transparent border-none cursor-pointer text-gray-700 hover:bg-gray-100 min-h-[44px] md:min-h-0">
                <Icono nombre={item.icono} size={18} />
                {item.label}
              </button>
            ))}
            <MenuSesion />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        className={`press flex-1 min-h-[52px] py-2 flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer ${abierto ? 'text-primary-600' : 'text-gray-500'}`}
      >
        <Icono nombre="admin" size={24} />
        <span className={`text-[11px] ${abierto || secundarioActivo ? 'font-bold' : 'font-medium'}`}>Más</span>
      </button>
      {abierto && (
        <div role="menu" className="absolute bottom-[calc(100%+8px)] right-2 w-56 bg-white rounded-[18px] border border-black/5 shadow-suave p-1.5 animate-pop-in">
          {items.map(item => (
            <button key={item.path} role="menuitem" onClick={() => ir(item.path)}
              className="press w-full px-3 py-2.5 flex items-center gap-2.5 text-left text-sm rounded-[12px] bg-transparent border-none cursor-pointer text-gray-700 hover:bg-gray-100 min-h-[44px]">
              <Icono nombre={item.icono} size={18} />
              {item.label}
            </button>
          ))}
          <MenuSesion />
        </div>
      )}
    </div>
  )
}

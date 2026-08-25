import { useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useSignOut } from '../../hooks/useSignOut'
import { formatFechaLarga } from '../../lib/format'
import RoleGate from '../RoleGate'
import { ROLES } from '../../lib/constants/roles'

export default function CajaHeader({ local, fechaISO, cajaAbierta, esHoy, onRefresh, onAyuda }) {
  const router = useRouter()
  const signOut = useSignOut()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef(null)
  useClickOutside(menuRef, () => setMenuAbierto(false), menuAbierto)

  const ir = (path) => { setMenuAbierto(false); router.push(path) }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center gap-3">
        <div className="min-w-0">
          <h1 className="m-0 text-base md:text-lg font-bold text-gray-900 truncate">💰 {local.nombre}</h1>
          <p className="mt-0.5 text-xs text-gray-500 flex items-center gap-2 flex-wrap m-0">
            <span className="capitalize">{formatFechaLarga(fechaISO + 'T12:00:00')}</span>
            {cajaAbierta && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />Abierta
              </span>
            )}
            {!cajaAbierta && esHoy && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded font-semibold">Cerrada</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onRefresh} className="hidden md:block px-3 py-1.5 bg-blue-100 text-blue-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-200">
            🔄 Actualizar
          </button>
          <button onClick={onAyuda} className="hidden md:block px-3 py-1.5 bg-gray-100 text-gray-600 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200">
            💬 Ayuda
          </button>

          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuAbierto(o => !o)} aria-label="Menú" aria-expanded={menuAbierto}
              className="p-2 bg-gray-100 text-gray-600 border-none rounded-md cursor-pointer hover:bg-gray-200 leading-none">☰</button>
            {menuAbierto && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-40">
                <RoleGate allowedRoles={[ROLES.OWNER]}>
                  <button onClick={() => ir('/admin?tab=miembros')} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 bg-transparent border-none cursor-pointer">👥 Miembros</button>
                </RoleGate>
                <button onClick={() => ir('/reportes')} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 bg-transparent border-none cursor-pointer">📊 Reportes</button>
                <button onClick={() => ir('/locales')} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 bg-transparent border-none cursor-pointer">← Volver a locales</button>
                <hr className="my-1 border-gray-200" />
                <button onClick={() => { setMenuAbierto(false); onAyuda() }} className="md:hidden w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 bg-transparent border-none cursor-pointer">💬 Ayuda</button>
                <button onClick={signOut} className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 bg-transparent border-none cursor-pointer">🚪 Salir</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

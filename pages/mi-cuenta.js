import { useState, useCallback, useEffect } from 'react'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useMisLocales } from '../hooks/useMisLocales'
import { useTerminosGuard } from '../hooks/useTerminosGuard'
import { getSuscripcionDeCuenta } from '../lib/services/suscripciones'
import { ROLES } from '../lib/constants/roles'
import LoadingScreen from '../components/ui/LoadingScreen'
import AppHeader from '../components/layout/AppHeader'
import BottomNav from '../components/layout/BottomNav'
import Icono from '../components/ui/Icono'
import MenuSesion from '../components/layout/MenuSesion'
import SuscripcionTab from '../components/admin/SuscripcionTab'
import TerminosBloqueoModal from '../components/TerminosBloqueoModal'

/**
 * Suscripción a nivel de CUENTA, sin pasar por ningún local — antes vivía
 * como tab dentro de /admin, que exige elegir un activeLocalId primero,
 * pese a que suscripciones_cuenta es por owner_id y no tiene fila por
 * local (ver lib/services/suscripciones.js). Esto es puramente dónde
 * vive la pantalla: SuscripcionTab y las llamadas a Mercado Pago no cambian.
 */
export default function MiCuenta() {
  const { user, checking } = useAuthGuard()
  const terminos = useTerminosGuard(user?.id)
  const { locales, cargado: localesCargados } = useMisLocales(user?.id)
  const [suscripcion, setSuscripcion] = useState(null)
  const [cargandoSuscripcion, setCargandoSuscripcion] = useState(true)

  const cargar = useCallback(async () => {
    if (!user?.id) return
    try {
      setSuscripcion(await getSuscripcionDeCuenta(user.id))
    } finally {
      setCargandoSuscripcion(false)
    }
  }, [user?.id])

  useEffect(() => { cargar() }, [cargar])

  if (checking || cargandoSuscripcion || !localesCargados || terminos.checking) {
    return <LoadingScreen mensaje="Cargando tu cuenta…" />
  }

  if (terminos.debeAceptar) return <TerminosBloqueoModal isOpen onAceptar={terminos.aceptar} />

  const localesPropios = locales.filter(l => l.rol === ROLES.OWNER)

  return (
    <main className="min-h-screen bg-fondo pb-20 md:pb-10 md:pl-56">
      <AppHeader ocultarNavDesktop sinLocal titulo="Mi cuenta" />

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <SuscripcionTab suscripcion={suscripcion} onCambio={cargar} />

        <div className="bg-white rounded-[20px] border border-black/5 shadow-suave p-5">
          <h2 className="text-base font-bold text-gray-900 m-0 mb-3">
            Este plan cubre {localesPropios.length} local{localesPropios.length === 1 ? '' : 'es'}
          </h2>
          {localesPropios.length === 0 ? (
            <p className="text-sm text-gray-500 m-0">Todavía no creaste ningún local.</p>
          ) : (
            <ul className="space-y-1.5 pl-0 list-none m-0">
              {localesPropios.map(l => (
                <li key={l.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <Icono nombre="inicio" size={16} className="text-gray-400" />
                  <span className="font-semibold text-gray-900">{l.nombre}</span>
                  {l.rubro && <span className="text-gray-400">· {l.rubro}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* En mobile no hay barra lateral: las acciones de sesión viven acá */}
        <div className="md:hidden"><MenuSesion /></div>
      </div>

      <BottomNav activeTab="mi-cuenta" lateral cantidadLocales={locales.length} />
    </main>
  )
}

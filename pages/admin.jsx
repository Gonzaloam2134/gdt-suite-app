import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { useUserRole } from '../lib/UserRoleContext'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useSuscripcionGuard } from '../hooks/useSuscripcionGuard'
import { useTerminosGuard } from '../hooks/useTerminosGuard'
import { useAdminData } from '../hooks/useAdminData'
import { ROLES } from '../lib/constants/roles'
import { useMisLocales } from '../hooks/useMisLocales'

import LoadingScreen from '../components/ui/LoadingScreen'
import BottomNav from '../components/layout/BottomNav'
import AppHeader from '../components/layout/AppHeader'
import Tabs from '../components/admin/Tabs'
import ResumenTab from '../components/admin/ResumenTab'
import MiembrosTab from '../components/admin/MiembrosTab'
import MediosPagoTab from '../components/admin/MediosPagoTab'
import MercadoPagoClienteTab from '../components/admin/MercadoPagoClienteTab'
import ListaLogs from '../components/admin/ListaLogs'
import TerminosBloqueoModal from '../components/TerminosBloqueoModal'

// Configuración: lo que se arma una vez (equipo, medios de cobro, Mercado Pago) primero;
// lo que se consulta (actividad, resumen del período) después.
const TABS_OWNER = [
  { id: 'miembros', label: 'Equipo', icono: 'equipo' },
  { id: 'medios-pago', label: 'Medios de cobro', icono: 'tarjeta' },
  { id: 'mercadopago', label: 'Mercado Pago', icono: 'inicio' },
  { id: 'logs', label: 'Actividad', icono: 'historial' },
  { id: 'resumen', label: 'Resumen del período', icono: 'reportes' },
]

export default function AdminPanel() {
  const router = useRouter()
  const { checking } = useAuthGuard()
  const { role, userId, activeLocalId, esSuperUser, loading: cargandoRol } = useUserRole()
  const terminos = useTerminosGuard(userId)
  // El super admin no queda bloqueado por la suscripción: administra el local
  // desde acá y desde /superadmin, no tendría sentido que lo echen de los dos.
  // OJO: hay que esperar `cargandoRol` antes de decidir esto — `esSuperUser`
  // arranca en `false` mientras el contexto todavía no resolvió la sesión, y
  // `getSuscripcion` (una sola consulta) puede responder antes que las tres
  // del contexto. Mirar solo `esSuperUser` dejaba pasar la carrera: un super
  // admin real podía ser echado del local que estaba administrando antes de
  // que la app se enterara de que lo era.
  const guardSuscripcion = useSuscripcionGuard(cargandoRol ? null : (esSuperUser ? null : activeLocalId), 'total')
  const { local, stats, miembros, inactivos, invitaciones, mediosPago, suscripcion, logs, periodo, loading, aplicarPreset, aplicarFechas, recargar } = useAdminData()
  const { locales } = useMisLocales(userId)
  const [tab, setTab] = useState(router.query.tab || 'miembros')

  useEffect(() => { if (router.query.tab) setTab(router.query.tab) }, [router.query.tab])

  // Vuelta del callback de OAuth de Mercado Pago (pages/api/mercadopago-cliente/callback.js)
  useEffect(() => {
    const { mp_cliente } = router.query
    if (!mp_cliente) return
    if (mp_cliente === 'conectado') toast.success('Cuenta de Mercado Pago conectada')
    else if (mp_cliente === 'cancelado') toast('Conexión con Mercado Pago cancelada')
    else if (mp_cliente === 'error') toast.error('No se pudo conectar con Mercado Pago. Probá de nuevo.')
    const { mp_cliente: _omit, ...resto } = router.query
    router.replace({ pathname: router.pathname, query: resto }, undefined, { shallow: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.mp_cliente])

  // El panel global vive en /superadmin; acá se administra un local puntual.
  useEffect(() => {
    if (!cargandoRol && esSuperUser && !activeLocalId) router.replace('/superadmin')
  }, [cargandoRol, esSuperUser, activeLocalId, router])

  if (checking || cargandoRol || loading || guardSuscripcion.checking || guardSuscripcion.debeRedirigir || terminos.checking) return <LoadingScreen mensaje="Cargando panel…" />

  if (terminos.debeAceptar) return <TerminosBloqueoModal isOpen onAceptar={terminos.aceptar} />

  if (!activeLocalId) {
    return (
      <main className="min-h-screen bg-fondo md:pl-56">
        <AppHeader ocultarNavDesktop titulo="Configuración" locales={locales} localId={activeLocalId} />
        <div className="max-w-6xl mx-auto p-4">
          <p className="text-sm text-gray-600">Elegí un local para administrarlo.</p>
        </div>
        <BottomNav activeTab="admin" lateral cantidadLocales={locales.length} />
      </main>
    )
  }

  const esOwner = role === ROLES.OWNER || esSuperUser

  // Cajero y empleado: solo su propia actividad
  if (!esOwner) {
    return (
      <main className="min-h-screen bg-fondo pb-20 md:pl-56">
        <AppHeader ocultarNavDesktop titulo="Mi actividad" locales={locales} localId={activeLocalId} />
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          <p className="text-sm text-primary-700 bg-primary-50 border border-primary-500/30 rounded-[14px] p-3 m-0">
            Acá ves el registro de lo que fuiste cargando. Solo el dueño del local ve la actividad de todo el equipo.
          </p>
          <ListaLogs logs={logs} titulo="Mis acciones" />
        </div>
        <BottomNav activeTab="admin" lateral cantidadLocales={locales.length} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-fondo pb-20 md:pl-56">
      <AppHeader ocultarNavDesktop titulo="Configuración" locales={locales} localId={activeLocalId} />

      <div className="max-w-6xl mx-auto p-4">
        <Tabs tabs={TABS_OWNER} activa={tab} onChange={setTab} />

        {tab === 'resumen' && (
          <ResumenTab stats={stats} logs={logs} periodo={periodo} onPreset={aplicarPreset} onFechas={aplicarFechas} />
        )}
        {tab === 'miembros' && (
          <MiembrosTab miembros={miembros} inactivos={inactivos} invitaciones={invitaciones} suscripcion={suscripcion}
            localId={activeLocalId} userId={userId} onCambio={recargar} />
        )}
        {tab === 'medios-pago' && (
          <MediosPagoTab mediosPago={mediosPago} localId={activeLocalId} userId={userId} onCambio={recargar} />
        )}
        {tab === 'mercadopago' && (
          <MercadoPagoClienteTab
            local={local} localId={activeLocalId} onCambio={recargar}
            ownerId={local?.creado_por} locales={locales}
          />
        )}
        {tab === 'logs' && <ListaLogs logs={logs} titulo="Auditoría del local" />}
      </div>

      <BottomNav activeTab="admin" lateral cantidadLocales={locales.length} />
    </main>
  )
}

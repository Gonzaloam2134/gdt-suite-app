import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useUserRole } from '../lib/UserRoleContext'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useSuscripcionGuard } from '../hooks/useSuscripcionGuard'
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
import SuscripcionTab from '../components/admin/SuscripcionTab'
import ListaLogs from '../components/admin/ListaLogs'

const TABS_OWNER = [
  { id: 'resumen', label: '📊 Resumen' },
  { id: 'miembros', label: '👥 Miembros' },
  { id: 'medios-pago', label: '💳 Medios de pago' },
  { id: 'suscripcion', label: '💎 Suscripción' },
  { id: 'logs', label: '📋 Auditoría' },
]

export default function AdminPanel() {
  const router = useRouter()
  const { checking } = useAuthGuard()
  const { role, userId, activeLocalId, esSuperUser, loading: cargandoRol } = useUserRole()
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
  const [tab, setTab] = useState(router.query.tab || 'resumen')

  useEffect(() => { if (router.query.tab) setTab(router.query.tab) }, [router.query.tab])

  // El panel global vive en /superadmin; acá se administra un local puntual.
  useEffect(() => {
    if (!cargandoRol && esSuperUser && !activeLocalId) router.replace('/superadmin')
  }, [cargandoRol, esSuperUser, activeLocalId, router])

  if (checking || cargandoRol || loading || guardSuscripcion.checking || guardSuscripcion.debeRedirigir) return <LoadingScreen mensaje="Cargando panel…" />

  if (!activeLocalId) {
    return (
      <main className="min-h-screen bg-slate-100">
        <AppHeader titulo="Administración" locales={locales} localId={activeLocalId} />
        <div className="max-w-6xl mx-auto p-4">
          <p className="text-sm text-gray-600">Elegí un local para administrarlo.</p>
        </div>
        <BottomNav activeTab="admin" />
      </main>
    )
  }

  const esOwner = role === ROLES.OWNER || esSuperUser

  // Cajero y empleado: solo su propia actividad
  if (!esOwner) {
    return (
      <main className="min-h-screen bg-slate-100 pb-20">
        <AppHeader titulo="Mi actividad" locales={locales} localId={activeLocalId} />
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-3 m-0">
            Acá ves el registro de lo que fuiste cargando. Solo el dueño del local ve la actividad de todo el equipo.
          </p>
          <ListaLogs logs={logs} titulo="Mis acciones" />
        </div>
        <BottomNav activeTab="admin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-20">
      <AppHeader titulo="Administración" locales={locales} localId={activeLocalId} />

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
        {tab === 'suscripcion' && <SuscripcionTab suscripcion={suscripcion} onCambio={recargar} />}
        {tab === 'logs' && <ListaLogs logs={logs} titulo="Auditoría del local" />}
      </div>

      <BottomNav activeTab="admin" />
    </main>
  )
}

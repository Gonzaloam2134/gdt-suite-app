import React from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useUserRole } from '../lib/UserRoleContext'
import { useTerminosGuard } from '../hooks/useTerminosGuard'
import { useSignOut } from '../hooks/useSignOut'
import { useSuperAdminManager } from '../hooks/useSuperAdminManager'
import Icono from '../components/ui/Icono'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import LoadingScreen from '../components/ui/LoadingScreen'
import TerminosBloqueoModal from '../components/TerminosBloqueoModal'
import TerminosEditorTab from '../components/admin/TerminosEditorTab'
import AnalyticsTab from '../components/admin/AnalyticsTab'
import BottomNav from '../components/layout/BottomNav'
import DashboardGlobalTab from '../components/admin/DashboardGlobalTab'
import ConsultasTab from '../components/admin/ConsultasTab'
import UsuariosTab from '../components/admin/UsuariosTab'
import LocalesTab from '../components/admin/LocalesTab'
import SuscripcionesTab from '../components/admin/SuscripcionesTab'
import ConfiguracionTab from '../components/admin/ConfiguracionTab'
import AnunciosTab from '../components/admin/AnunciosTab'
import CashflowTab from '../components/admin/CashflowTab'

export default function SuperAdmin() {
  const router = useRouter()
  const { user, checking } = useAuthGuard()
  const { esSuperUser, loading: cargandoRol } = useUserRole()
  const terminos = useTerminosGuard(user?.id)
  const signOut = useSignOut()

  const manager = useSuperAdminManager()
  const {
    activeTab, setActiveTab, tabsScrollRef, tabsPuedeIzq, tabsPuedeDer, desplazarTabs,
    loading, recargar
  } = manager

  useEffect(() => {
    if (checking || cargandoRol) return
    if (!esSuperUser) {
      toast.error('No tenés permisos de super administrador')
      router.replace('/locales')
    }
  }, [checking, cargandoRol, esSuperUser, router])

  if (checking || cargandoRol || !esSuperUser || terminos.checking) return <LoadingScreen mensaje="Verificando acceso…" icono="corona" />
  if (terminos.debeAceptar) return <TerminosBloqueoModal isOpen onAceptar={terminos.aceptar} />
  if (loading) return <div className="min-h-screen bg-fondo flex items-center justify-center"><p>Cargando panel de super admin...</p></div>

  return (
    <main className="min-h-screen bg-fondo pb-20 md:pb-8 md:pl-56">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="m-0 text-lg font-bold text-gray-900 inline-flex items-center gap-2"><span className="text-primary-600"><Icono nombre="corona" size={22} /></span>Super Admin</h1>
            <p className="mt-0.5 text-xs text-gray-500">Panel de control global de la plataforma</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/locales')} className="px-3 py-1.5 bg-gray-100 text-gray-600 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200">← Volver a Mis Locales</button>
            <button onClick={signOut} className="px-3 py-1.5 bg-gray-100 text-gray-500 border-none rounded-md text-xs font-medium cursor-pointer hover:bg-gray-200">Salir</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        <div className="relative mb-4">
          <div ref={tabsScrollRef} onScroll={manager.actualizarSombrasTabs} className="flex gap-2 border-b border-gray-200 overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard Global', icono: 'reportes' },
              { id: 'analytics', label: 'Análisis', icono: 'reportes' },
              { id: 'contactos', label: 'Consultas', icono: 'mail' },
              { id: 'usuarios', label: 'Usuarios', icono: 'equipo' },
              { id: 'locales', label: 'Locales', icono: 'inicio' },
              { id: 'suscripciones', label: 'Suscripciones', icono: 'tarjeta' },
              { id: 'config', label: 'Configuración', icono: 'admin' },
              { id: 'terminos', label: 'Términos', icono: 'candado' },
              { id: 'anuncios', label: 'Anuncios', icono: 'novedades' },
              { id: 'cashflow', label: 'Cashflow', icono: 'dinero' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-semibold cursor-pointer border-none rounded-t-lg whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-white text-primary-600 border-b-2 border-primary-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <span className="inline-flex items-center gap-2"><Icono nombre={tab.icono} size={18} />{tab.label}</span>
                {tab.id === 'contactos' && manager.contactos.filter(c => c.estado === 'pendiente').length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">{manager.contactos.filter(c => c.estado === 'pendiente').length}</span>
                )}
              </button>
            ))}
          </div>
          {tabsPuedeIzq && <button onClick={() => desplazarTabs(-1)} className="absolute left-0 top-0 bottom-1 flex items-center pl-0.5 pr-3 border-none cursor-pointer bg-gradient-to-r from-fondo via-fondo to-transparent"><span className="w-6 h-6 rounded-full bg-white shadow border border-gray-300 flex items-center justify-center text-gray-600 text-sm leading-none">‹</span></button>}
          {tabsPuedeDer && <button onClick={() => desplazarTabs(1)} className="absolute right-0 top-0 bottom-1 flex items-center pr-0.5 pl-3 border-none cursor-pointer bg-gradient-to-l from-fondo via-fondo to-transparent"><span className="w-6 h-6 rounded-full bg-white shadow border border-gray-300 flex items-center justify-center text-gray-600 text-sm leading-none">›</span></button>}
        </div>

        {activeTab === 'dashboard' && <DashboardGlobalTab globalStats={manager.globalStats} />}
        {activeTab === 'analytics' && <AnalyticsTab locales={manager.todosLosLocales} suscripciones={manager.suscripciones} />}
        {activeTab === 'contactos' && <ConsultasTab {...manager} />}
        {activeTab === 'usuarios' && <UsuariosTab {...manager} />}
        {activeTab === 'locales' && <LocalesTab {...manager} />}
        {activeTab === 'suscripciones' && <SuscripcionesTab {...manager} />}
        {activeTab === 'config' && <ConfiguracionTab {...manager} />}
        {activeTab === 'terminos' && <TerminosEditorTab config={manager.config} onGuardado={recargar} />}
        {activeTab === 'anuncios' && <AnunciosTab {...manager} />}
        {activeTab === 'cashflow' && <CashflowTab pagosSuscripcion={manager.pagosSuscripcion} suscripciones={manager.suscripciones} usuarios={manager.usuarios} />}
      </div>

      <ConfirmDialog isOpen={!!manager.confirmarLocal} onClose={() => manager.setConfirmarLocal(null)} onConfirm={manager.confirmarSuspenderLocal} danger={!manager.confirmarLocal?.suspendido} title={manager.confirmarLocal?.suspendido ? 'Activar local' : 'Suspender local'} message={`¿Confirmás ${manager.confirmarLocal?.suspendido ? 'activar' : 'suspender'} "${manager.confirmarLocal?.nombre}"?`} confirmLabel={manager.confirmarLocal?.suspendido ? 'Activar' : 'Suspender'} />
      <ConfirmDialog isOpen={!!manager.confirmarSuscripcion} onClose={() => manager.setConfirmarSuscripcion(null)} onConfirm={manager.confirmarCambioSuscripcion} danger={manager.confirmarSuscripcion?.nuevoEstado === 'suspended'} title="Cambiar estado de suscripción" message={`¿Confirmás cambiar el estado de "${manager.confirmarSuscripcion?.nombreLocal}" a "${manager.confirmarSuscripcion?.nuevoEstado?.toUpperCase()}"?`} confirmLabel="Cambiar estado" />
      <ConfirmDialog isOpen={!!manager.aEliminarAnuncio} onClose={() => manager.setAEliminarAnuncio(null)} onConfirm={manager.handleEliminarAnuncio} danger title="Eliminar anuncio" message={`¿Confirmás eliminar "${manager.aEliminarAnuncio?.titulo}"?`} confirmLabel="Eliminar" />
      <ConfirmDialog isOpen={!!manager.confirmarEmail} onClose={() => manager.setConfirmarEmail(null)} onConfirm={manager.confirmarCambioEmail} danger title="Cambiar el email de acceso" message={`Esta persona va a dejar de poder entrar con "${manager.confirmarEmail?.emailActual}" y va a tener que usar "${manager.confirmarEmail?.emailNuevo}" de ahora en más. ¿Confirmás?`} confirmLabel={manager.guardandoEmail ? 'Guardando…' : 'Sí, cambiar'} />
      <BottomNav activeTab="panel-global" lateral cantidadLocales={0} />
    </main>
  )
}

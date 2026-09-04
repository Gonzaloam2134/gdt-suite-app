import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useUserRole } from '../lib/UserRoleContext'
import { LABEL_SEGMENTO, LABEL_CICLO } from '../lib/constants/planes'
import { useSignOut } from '../hooks/useSignOut'
import { useSuperAdminData } from '../hooks/useSuperAdminData'
import { cambiarEstadoSuscripcion, cambiarEstadoCuenta } from '../lib/services/suscripciones'
import { responderContacto } from '../lib/services/contactos'
import { actualizarUsuario, guardarConfigGlobal } from '../lib/services/superadmin'
import { actualizarPrecioPlan } from '../lib/services/planes'
import { formatCurrency, formatFecha } from '../lib/format'
import { agruparPagosPorMes, proyectarCashflow, totalCobradoHistorico, mrrActual } from '../lib/domain/cashflow'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { crearAnuncio, actualizarAnuncio, cambiarActivoAnuncio, eliminarAnuncio } from '../lib/services/anuncios'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import LoadingScreen from '../components/ui/LoadingScreen'

/**
 * Panel global de la plataforma. A diferencia del resto de la app, acá no hay
 * `activeLocalId`: se administra TODO (todos los locales, todos los usuarios).
 * Por eso las consultas van sin filtrar por local — la RLS de `perfiles.rol_global
 * = 'super_user'` es la única barrera, chequeada abajo con useUserRole().
 */
export default function SuperAdmin() {
  const router = useRouter()
  const { user, checking } = useAuthGuard()
  const { esSuperUser, loading: cargandoRol } = useUserRole()
  const signOut = useSignOut()
  const {
    globalStats, contactos, usuarios, todosLosLocales, suscripciones,
    config, setConfig, anuncios, planes, pagosSuscripcion, loading, recargar,
  } = useSuperAdminData()

  // Precios editables: se parte de lo que viene de la base, y se guarda
  // por fila (no hay "guardar todo junto" — cada plan se ajusta por separado).
  const [preciosEditando, setPreciosEditando] = useState({})   // { [id]: precioComoString }
  const [guardandoPrecio, setGuardandoPrecio] = useState(null) // id en proceso, o null

  // 7 pestañas no entran en un celular, y sin nada que lo sugiera el
  // scroll horizontal pasa desapercibido (mismo problema que ya se
  // encontró y arregló en components/admin/Tabs.jsx).
  const tabsScrollRef = useRef(null)
  const [tabsPuedeIzq, setTabsPuedeIzq] = useState(false)
  const [tabsPuedeDer, setTabsPuedeDer] = useState(false)
  const actualizarSombrasTabs = useCallback(() => {
    const el = tabsScrollRef.current
    if (!el) return
    setTabsPuedeIzq(el.scrollLeft > 4)
    setTabsPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])
  useEffect(() => {
    actualizarSombrasTabs()
    const t = setTimeout(actualizarSombrasTabs, 150)
    window.addEventListener('resize', actualizarSombrasTabs)
    return () => { clearTimeout(t); window.removeEventListener('resize', actualizarSombrasTabs) }
  }, [actualizarSombrasTabs])
  const desplazarTabs = (dir) => tabsScrollRef.current?.scrollBy({ left: dir * 140, behavior: 'smooth' })

  const [activeTab, setActiveTab] = useState('dashboard')

  // Consultas
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [respondiendoId, setRespondiendoId] = useState(null)
  const [respuestaTexto, setRespuestaTexto] = useState('')

  // Usuarios: rol global, y el email de acceso real (auth.users + perfiles,
  // vía pages/api/admin/actualizar-email.js con Service Role).
  const [editandoUsuario, setEditandoUsuario] = useState(null)
  const [nuevoRol, setNuevoRol] = useState('')
  const [editandoEmail, setEditandoEmail] = useState(null)   // id del usuario, o null
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [confirmarEmail, setConfirmarEmail] = useState(null)  // { id, emailActual, emailNuevo } o null
  const [guardandoEmail, setGuardandoEmail] = useState(false)

  // Locales — "suspender" acá cambia suscripciones.estado (lo mismo que la
  // pestaña Suscripciones): es el único mecanismo real de bloqueo. locales.activo
  // es otra cosa — un archivado que decide el propio dueño, sin relación con el
  // pago — y ya no se toca desde acá.
  const [filtroLocal, setFiltroLocal] = useState('')
  const [confirmarLocal, setConfirmarLocal] = useState(null) // { id, nombre, suspendido }

  // Suscripciones
  const [filtroSuscripcion, setFiltroSuscripcion] = useState('todos')
  const [confirmarSuscripcion, setConfirmarSuscripcion] = useState(null) // { localId, nombreLocal, nuevoEstado }

  // Anuncios
  const [nuevoAnuncio, setNuevoAnuncio] = useState({ titulo: '', mensaje: '', tipo: 'info' })
  const [editandoAnuncio, setEditandoAnuncio] = useState(null)   // { id, titulo, mensaje, tipo } o null
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [aEliminarAnuncio, setAEliminarAnuncio] = useState(null)
  const [publicando, setPublicando] = useState(false)

  useEffect(() => {
    if (checking || cargandoRol) return
    if (!esSuperUser) {
      toast.error('No tenés permisos de super administrador')
      router.replace('/locales')
    }
  }, [checking, cargandoRol, esSuperUser, router])

  const handleResponderContacto = async (contactoId) => {
    if (!respuestaTexto.trim()) return toast.error('Escribí una respuesta')
    try {
      await responderContacto(contactoId, respuestaTexto.trim())
      toast.success('✅ Respuesta enviada')
      setRespondiendoId(null)
      setRespuestaTexto('')
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleActualizarUsuario = async (userId) => {
    if (!nuevoRol) return
    try {
      await actualizarUsuario(userId, { rol_global: nuevoRol })
      toast.success('✅ Usuario actualizado')
      setEditandoUsuario(null)
      setNuevoRol('')
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const confirmarSuspenderLocal = async () => {
    if (!confirmarLocal) return
    try {
      await cambiarEstadoSuscripcion(confirmarLocal.id, confirmarLocal.suspendido ? 'active' : 'suspended')
      toast.success(`✅ Local ${confirmarLocal.suspendido ? 'activado' : 'suspendido'} correctamente`)
      setConfirmarLocal(null)
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const confirmarCambioSuscripcion = async () => {
    if (!confirmarSuscripcion) return
    try {
      await cambiarEstadoCuenta(confirmarSuscripcion.ownerId, confirmarSuscripcion.nuevoEstado)
      toast.success(`✅ Estado actualizado a ${confirmarSuscripcion.nuevoEstado}`)
      setConfirmarSuscripcion(null)
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleGuardarConfig = async () => {
    try {
      await guardarConfigGlobal(config)
      toast.success('✅ Configuración guardada')
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const confirmarCambioEmail = async () => {
    if (!confirmarEmail) return
    setGuardandoEmail(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/actualizar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: confirmarEmail.id, nuevoEmail: confirmarEmail.emailNuevo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo cambiar el email')
      if (data?.warning) {
        toast(data.warning, { icon: '⚠️' })
      } else {
        toast.success('Email actualizado — ya puede iniciar sesión con el nuevo')
      }
      setEditandoEmail(null); setNuevoEmail(''); setConfirmarEmail(null)
      await recargar()
    } catch (err) {
      toast.error(err.message || 'Error al cambiar el email')
    } finally {
      setGuardandoEmail(false)
    }
  }

  const handleGuardarPrecio = async (plan) => {
    const nuevoValor = preciosEditando[plan.id]
    const precio = Number(nuevoValor)
    if (!Number.isFinite(precio) || precio < 0) return toast.error('Ingresá un precio válido')
    setGuardandoPrecio(plan.id)
    try {
      await actualizarPrecioPlan(plan.segmento, plan.ciclo, precio)
      toast.success(`${LABEL_SEGMENTO[plan.segmento]} (${LABEL_CICLO[plan.ciclo]}) actualizado`)
      await recargar()
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar el precio')
    } finally {
      setGuardandoPrecio(null)
    }
  }

  const handleCrearAnuncio = async () => {
    if (!nuevoAnuncio.titulo.trim() || !nuevoAnuncio.mensaje.trim()) return toast.error('Completá título y mensaje')
    setPublicando(true)
    try {
      await crearAnuncio({ ...nuevoAnuncio, creadoPor: user.id })
      toast.success('✅ Anuncio publicado')
      setNuevoAnuncio({ titulo: '', mensaje: '', tipo: 'info' })
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally { setPublicando(false) }
  }

  const handleGuardarEdicion = async () => {
    if (!editandoAnuncio.titulo.trim() || !editandoAnuncio.mensaje.trim()) return toast.error('Completá título y mensaje')
    setGuardandoEdicion(true)
    try {
      await actualizarAnuncio(editandoAnuncio.id, editandoAnuncio)
      toast.success('Anuncio actualizado')
      setEditandoAnuncio(null)
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally { setGuardandoEdicion(false) }
  }

  const handleToggleActivo = async (anuncio) => {
    try {
      await cambiarActivoAnuncio(anuncio.id, !anuncio.activo)
      toast.success(anuncio.activo ? 'Anuncio ocultado' : 'Anuncio reactivado')
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleEliminarAnuncio = async () => {
    try {
      await eliminarAnuncio(aEliminarAnuncio.id)
      toast.success('Anuncio eliminado')
      setAEliminarAnuncio(null)
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  if (checking || cargandoRol || !esSuperUser) return <LoadingScreen mensaje="Verificando acceso…" icono="👑" />
  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p>Cargando panel de super admin...</p></div>

  return (
    <main className="min-h-screen bg-slate-100 pb-8">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="m-0 text-lg font-bold text-gray-900">👑 Super Admin</h1>
            <p className="mt-0.5 text-xs text-gray-500">Panel de control global de la plataforma</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/locales')}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200"
            >
              ← Volver a Mis Locales
            </button>
            <button
              onClick={signOut}
              className="px-3 py-1.5 bg-gray-100 text-gray-500 border-none rounded-md text-xs font-medium cursor-pointer hover:bg-gray-200"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        {/* Tabs */}
        <div className="relative mb-4">
        <div ref={tabsScrollRef} onScroll={actualizarSombrasTabs} className="flex gap-2 border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'dashboard', label: '📊 Dashboard Global' },
            { id: 'contactos', label: '📬 Consultas' },
            { id: 'usuarios', label: '👥 Usuarios' },
            { id: 'locales', label: '🏪 Locales' },
            { id: 'suscripciones', label: '💳 Suscripciones' },
            { id: 'config', label: '⚙️ Configuración' },
            { id: 'anuncios', label: '📢 Anuncios' },
            { id: 'cashflow', label: '💰 Cashflow' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-semibold cursor-pointer border-none rounded-t-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
              {tab.id === 'contactos' && contactos.filter(c => c.estado === 'pendiente').length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">
                  {contactos.filter(c => c.estado === 'pendiente').length}
                </span>
              )}
            </button>
          ))}
        </div>
        {tabsPuedeIzq && (
          <button type="button" aria-label="Ver pestañas anteriores" onClick={() => desplazarTabs(-1)}
            className="absolute left-0 top-0 bottom-1 flex items-center pl-0.5 pr-3 border-none cursor-pointer bg-gradient-to-r from-slate-100 via-slate-100 to-transparent">
            <span className="w-6 h-6 rounded-full bg-white shadow border border-gray-300 flex items-center justify-center text-gray-600 text-sm leading-none">‹</span>
          </button>
        )}
        {tabsPuedeDer && (
          <button type="button" aria-label="Ver más pestañas" onClick={() => desplazarTabs(1)}
            className="absolute right-0 top-0 bottom-1 flex items-center pr-0.5 pl-3 border-none cursor-pointer bg-gradient-to-l from-slate-100 via-slate-100 to-transparent">
            <span className="w-6 h-6 rounded-full bg-white shadow border border-gray-300 flex items-center justify-center text-gray-600 text-sm leading-none">›</span>
          </button>
        )}
        </div>

        {/* TAB: DASHBOARD GLOBAL */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 m-0">
                👑 Bienvenido al panel de super administrador. Acá tenés una vista global de toda la plataforma GDT Suite.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-xs text-gray-500 font-semibold mb-2">🏪 LOCALES REGISTRADOS</div>
                <div className="text-3xl font-extrabold text-blue-700">{globalStats.locales}</div>
                <div className="text-xs text-gray-400 mt-1">Total en la plataforma</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-xs text-gray-500 font-semibold mb-2">👥 USUARIOS ACTIVOS</div>
                <div className="text-3xl font-extrabold text-green-700">{globalStats.usuarios}</div>
                <div className="text-xs text-gray-400 mt-1">Cuentas registradas</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-xs text-gray-500 font-semibold mb-2">💳 TRANSACCIONES</div>
                <div className="text-3xl font-extrabold text-purple-700">{globalStats.transacciones}</div>
                <div className="text-xs text-gray-400 mt-1">Total procesadas</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CONSULTAS */}
        {activeTab === 'contactos' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 m-0">
                📬 Tenés <strong>{contactos.filter(c => c.estado === 'pendiente').length}</strong> consultas pendientes de {contactos.length} totales.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              {['todos', 'pendiente', 'resuelto', 'cerrado'].map(estado => (
                <button
                  key={estado}
                  onClick={() => setFiltroEstado(estado)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none ${
                    filtroEstado === estado
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {estado === 'todos' ? 'Todas' : estado.charAt(0).toUpperCase() + estado.slice(1)}
                  {estado !== 'todos' && ` (${contactos.filter(c => c.estado === estado).length})`}
                </button>
              ))}
            </div>

            {contactos
              .filter(c => filtroEstado === 'todos' || c.estado === filtroEstado)
              .map(contacto => {
                const esPendiente = contacto.estado === 'pendiente'
                const esResuelto = contacto.estado === 'resuelto'
                const estaRespondiendo = respondiendoId === contacto.id

                return (
                  <div key={contacto.id} className={`bg-white rounded-lg border-2 p-4 ${
                    esPendiente ? 'border-amber-300' : esResuelto ? 'border-green-300' : 'border-gray-200'
                  }`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            contacto.tipo_consulta === 'soporte' ? 'bg-red-100 text-red-700' :
                            contacto.tipo_consulta === 'feature' ? 'bg-purple-100 text-purple-700' :
                            contacto.tipo_consulta === 'facturacion' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {contacto.tipo_consulta?.toUpperCase() || 'GENERAL'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            esPendiente ? 'bg-amber-100 text-amber-700' :
                            esResuelto ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {contacto.estado.toUpperCase()}
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm mb-1">{contacto.asunto}</h4>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          <div>👤 {contacto.perfil?.email || 'Usuario desconocido'}</div>
                          {contacto.local?.nombre && <div>🏪 {contacto.local.nombre}</div>}
                          <div>📍 Desde: {contacto.pagina_origen || 'Web'}</div>
                          <div>🕐 {new Date(contacto.creado_en).toLocaleString('es-AR')}</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm text-gray-700 whitespace-pre-wrap">
                      {contacto.mensaje}
                    </div>

                    {contacto.respuesta && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                        <div className="text-xs text-green-700 font-bold mb-1">✅ RESPUESTA:</div>
                        <div className="text-sm text-green-900 whitespace-pre-wrap">{contacto.respuesta}</div>
                        {contacto.respondido_en && (
                          <div className="text-xs text-green-600 mt-1">
                            Respondido: {new Date(contacto.respondido_en).toLocaleString('es-AR')}
                          </div>
                        )}
                      </div>
                    )}

                    {esPendiente && !estaRespondiendo && (
                      <button
                        onClick={() => setRespondiendoId(contacto.id)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-600"
                      >
                        ✏️ Responder
                      </button>
                    )}

                    {estaRespondiendo && (
                      <div className="space-y-2">
                        <textarea
                          value={respuestaTexto}
                          onChange={(e) => setRespuestaTexto(e.target.value)}
                          placeholder="Escribí tu respuesta..."
                          rows={3}
                          className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-vertical"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResponderContacto(contacto.id)}
                            className="px-4 py-2 bg-green-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-green-600"
                          >
                            📤 Enviar respuesta
                          </button>
                          <button
                            onClick={() => { setRespondiendoId(null); setRespuestaTexto('') }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

            {contactos.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-gray-500 text-sm">No hay consultas de soporte aún.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: USUARIOS */}
        {activeTab === 'usuarios' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 m-0">
                👥 Gestioná los usuarios de la plataforma. Podés cambiar el rol global.
                El email de inicio de sesión se administra desde Supabase Auth, no desde acá.
              </p>
            </div>

            <div className="space-y-2">
              {usuarios.map(usuario => {
                const esActivo = usuario.activo !== false

                return (
                  <div key={usuario.id} className={`bg-white rounded-lg border-2 p-4 ${
                    esActivo ? 'border-gray-200' : 'border-red-300 bg-red-50'
                  }`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-bold text-gray-900 text-sm">{usuario.nombre || 'Sin nombre'}</div>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            usuario.rol_global === 'super_user' ? 'bg-purple-100 text-purple-700' :
                            usuario.rol_global === 'owner' ? 'bg-blue-100 text-blue-700' :
                            usuario.rol_global === 'cajero' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {usuario.rol_global?.toUpperCase() || 'USUARIO'}
                          </span>
                          {!esActivo && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">INACTIVO</span>}
                        </div>
                        <div className="text-xs text-gray-500 mb-2">{usuario.email}</div>
                      </div>
                    </div>

                    {editandoUsuario === usuario.id ? (
                      <div className="bg-slate-50 p-3 rounded-lg space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Cambiar rol global:</label>
                          <select
                            value={nuevoRol || usuario.rol_global}
                            onChange={(e) => setNuevoRol(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="owner">Owner</option>
                            <option value="cajero">Cajero</option>
                            <option value="empleado">Empleado</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleActualizarUsuario(usuario.id)}
                            className="px-4 py-2 bg-green-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-green-600"
                          >
                            💾 Guardar cambios
                          </button>
                          <button
                            onClick={() => { setEditandoUsuario(null); setNuevoRol('') }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : editandoEmail === usuario.id ? (
                      <div className="bg-slate-50 p-3 rounded-lg space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Nuevo email de acceso (también cambia con qué inicia sesión):
                          </label>
                          <input type="email" value={nuevoEmail} autoFocus
                            onChange={(e) => setNuevoEmail(e.target.value)}
                            placeholder={usuario.email}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm" />
                        </div>
                        <div className="flex gap-2">
                          <button
                            disabled={!/\S+@\S+\.\S+/.test(nuevoEmail) || nuevoEmail === usuario.email}
                            onClick={() => setConfirmarEmail({ id: usuario.id, emailActual: usuario.email, emailNuevo: nuevoEmail })}
                            className="px-4 py-2 bg-amber-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            💾 Guardar cambios
                          </button>
                          <button
                            onClick={() => { setEditandoEmail(null); setNuevoEmail('') }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => { setEditandoUsuario(usuario.id); setNuevoRol(usuario.rol_global) }}
                          className="px-4 py-2 bg-blue-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-600"
                        >
                          ✏️ Editar rol
                        </button>
                        <button
                          onClick={() => { setEditandoEmail(usuario.id); setNuevoEmail(usuario.email || '') }}
                          className="px-4 py-2 bg-amber-100 text-amber-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-amber-200"
                        >
                          ✉️ Editar email
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB: LOCALES */}
        {activeTab === 'locales' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 m-0">
                🏪 Gestioná todos los locales de la plataforma. Podés suspender locales problemáticos.
              </p>
            </div>

            <input
              type="text"
              placeholder="Buscar local por nombre..."
              value={filtroLocal}
              onChange={(e) => setFiltroLocal(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <div className="space-y-2">
              {todosLosLocales
                .filter(l => l.nombre.toLowerCase().includes(filtroLocal.toLowerCase()))
                .map(local => {
                  const miembrosActivos = local.miembros_locales?.filter(m => m.activo !== false).length || 0
                  // El único bloqueo real es suscripciones.estado (unificado con la
                  // pestaña Suscripciones). Un local sin fila de suscripción no está
                  // suspendido (mismo criterio que usa /locales para decidir el acceso).
                  const estadoSuscripcion = suscripciones.find(s => s.local_id === local.id)?.estado || 'active'
                  const estaSuspendido = estadoSuscripcion === 'suspended'

                  return (
                    <div key={local.id} className={`bg-white rounded-lg border-2 p-4 ${
                      estaSuspendido ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-bold text-gray-900 text-sm">{local.nombre}</div>
                            {estaSuspendido && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">SUSPENDIDO</span>}
                          </div>
                          <div className="text-xs text-gray-500 space-y-0.5">
                            <div>🏢 Rubro: {local.rubro || 'Sin rubro'}</div>
                            <div>📄 Condición fiscal: {local.condicion_fiscal || 'Sin especificar'}</div>
                            <div>🕐 Creado: {new Date(local.creado_en).toLocaleDateString('es-AR')}</div>
                          </div>
                        </div>
                      </div>

                      {local.miembros_locales && local.miembros_locales.length > 0 && (
                        <div className="mb-3 text-xs text-gray-600">
                          <div className="font-semibold mb-1">👥 Miembros ({miembrosActivos} activos):</div>
                          {local.miembros_locales.slice(0, 5).map((m, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span>{m.perfiles?.email || 'Usuario'}</span>
                              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{m.rol.toUpperCase()}</span>
                              {m.activo === false && <span className="text-red-600 text-xs">(inactivo)</span>}
                            </div>
                          ))}
                          {local.miembros_locales.length > 5 && (
                            <div className="text-gray-400">... y {local.miembros_locales.length - 5} más</div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => setConfirmarLocal({ id: local.id, nombre: local.nombre, suspendido: estaSuspendido })}
                        className={`px-4 py-2 rounded-md text-xs font-semibold cursor-pointer ${
                          estaSuspendido
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-red-500 text-white hover:bg-red-600'
                        }`}
                      >
                        {estaSuspendido ? '✅ Activar local' : '🚫 Suspender local'}
                      </button>
                    </div>
                  )
                })}
            </div>

            {todosLosLocales.filter(l => l.nombre.toLowerCase().includes(filtroLocal.toLowerCase())).length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <div className="text-5xl mb-3">🔍</div>
                <p className="text-gray-500 text-sm">No se encontraron locales.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: SUSCRIPCIONES Y PAGOS */}
        {activeTab === 'suscripciones' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 m-0">
                💳 Gestioná el estado de pago de cada local. Podés restringir funcionalidades o suspender el acceso si no pagan.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              {['todos', 'active', 'restricted', 'suspended'].map(estado => (
                <button
                  key={estado}
                  onClick={() => setFiltroSuscripcion(estado)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none ${
                    filtroSuscripcion === estado
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {estado === 'todos' ? 'Todos' : estado === 'active' ? '🟢 Activos' : estado === 'restricted' ? '🟡 Restringidos' : '🔴 Suspendidos'}
                  {estado !== 'todos' && ` (${suscripciones.filter(s => s.estado === estado).length})`}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {suscripciones
                .filter(s => filtroSuscripcion === 'todos' || s.estado === filtroSuscripcion)
                .map(sub => {
                  const isVencido = sub.fecha_vencimiento && new Date(sub.fecha_vencimiento) < new Date()

                  return (
                    <div key={sub.id} className={`bg-white rounded-lg border-2 p-4 ${
                      sub.estado === 'active' ? 'border-green-200' :
                      sub.estado === 'restricted' ? 'border-amber-200 bg-amber-50' :
                      'border-red-200 bg-red-50'
                    }`}>
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-gray-900">
                              {sub.locales?.[0]?.nombre || 'Sin local'}
                              {sub.cantidadLocales > 1 && <span className="text-gray-400 font-normal"> +{sub.cantidadLocales - 1} más</span>}
                            </h4>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              sub.estado === 'active' ? 'bg-green-100 text-green-700' :
                              sub.estado === 'restricted' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {sub.estado === 'active' ? 'ACTIVO' : sub.estado === 'restricted' ? 'RESTRINGIDO (Solo lectura)' : 'SUSPENDIDO'}
                            </span>
                            {isVencido && sub.estado === 'active' && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">VENCIDO</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>👤 Owner: {sub.ownerEmail}</div>
                            <div>
                              📦 Plan: <span className="font-semibold uppercase">{sub.plan}</span>
                              {sub.plan === 'pago' && sub.segmento && (
                                <span className="ml-1 text-gray-500">
                                  · {LABEL_SEGMENTO[sub.segmento] || sub.segmento}
                                  {sub.ciclo && ` (${LABEL_CICLO[sub.ciclo] || sub.ciclo})`}
                                </span>
                              )}
                            </div>
                            <div>📅 Vencimiento: {sub.fecha_vencimiento ? new Date(sub.fecha_vencimiento).toLocaleDateString('es-AR') : 'Sin fecha'}</div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 min-w-[200px]">
                          {sub.estado !== 'active' && (
                            <button
                              onClick={() => setConfirmarSuscripcion({ ownerId: sub.owner_id, nombreLocal: sub.locales?.[0]?.nombre, nuevoEstado: 'active' })}
                              className="px-3 py-2 bg-green-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-green-600"
                            >
                              ✅ Activar / Desbloquear
                            </button>
                          )}
                          {sub.estado !== 'restricted' && (
                            <button
                              onClick={() => setConfirmarSuscripcion({ ownerId: sub.owner_id, nombreLocal: sub.locales?.[0]?.nombre, nuevoEstado: 'restricted' })}
                              className="px-3 py-2 bg-amber-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-amber-600"
                            >
                              🟡 Restringir (Solo Reportes)
                            </button>
                          )}
                          {sub.estado !== 'suspended' && (
                            <button
                              onClick={() => setConfirmarSuscripcion({ ownerId: sub.owner_id, nombreLocal: sub.locales?.[0]?.nombre, nuevoEstado: 'suspended' })}
                              className="px-3 py-2 bg-red-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-red-600"
                            >
                              🔴 Suspender Acceso Total
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* TAB: CONFIGURACIÓN */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 m-0">
                ⚙️ Configuración global de la plataforma. Estos valores afectan a todos los usuarios y locales.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4">Parámetros globales</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Máximo de locales por usuario:</label>
                  <input
                    type="number"
                    value={config.max_locales_por_usuario}
                    onChange={(e) => setConfig({...config, max_locales_por_usuario: parseInt(e.target.value) || 0})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Comisión por defecto (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.comision_default}
                    onChange={(e) => setConfig({...config, comision_default: parseFloat(e.target.value) || 0})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Plazo de acreditación default (días):</label>
                  <input
                    type="number"
                    value={config.plazo_acreditacion_default}
                    onChange={(e) => setConfig({...config, plazo_acreditacion_default: parseInt(e.target.value) || 0})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Modo mantenimiento:</label>
                  <select
                    value={config.mantenimiento_activo ? 'si' : 'no'}
                    onChange={(e) => setConfig({...config, mantenimiento_activo: e.target.value === 'si'})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="no">Desactivado</option>
                    <option value="si">Activado (bloquea accesos)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGuardarConfig}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600"
              >
                💾 Guardar configuración
              </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-base font-bold text-gray-900 mb-1">Precios de los planes</h3>
              <p className="text-xs text-gray-500 mb-4">
                Cada fila se guarda por separado. Un cambio acá solo afecta a las
                suscripciones NUEVAS que se creen a partir de ahora — nunca a las
                que ya están activas, esas quedan con el precio que pagaron.
              </p>
              <div className="space-y-2">
                {planes.map(plan => {
                  const valorEditando = preciosEditando[plan.id] ?? String(plan.precio)
                  const cambio = Number(valorEditando) !== Number(plan.precio)
                  return (
                    <div key={plan.id} className="flex items-center gap-3 flex-wrap p-3 bg-slate-50 rounded-lg">
                      <div className="min-w-[160px]">
                        <div className="text-sm font-semibold text-gray-800">{LABEL_SEGMENTO[plan.segmento] || plan.segmento}</div>
                        <div className="text-xs text-gray-500">{LABEL_CICLO[plan.ciclo] || plan.ciclo} · hoy: {formatCurrency(plan.precio)}</div>
                      </div>
                      <input type="number" min="0" step="100"
                        value={valorEditando}
                        onChange={(e) => setPreciosEditando({ ...preciosEditando, [plan.id]: e.target.value })}
                        className="w-32 p-2 border border-gray-300 rounded-md text-sm" />
                      <button
                        onClick={() => handleGuardarPrecio(plan)}
                        disabled={!cambio || guardandoPrecio === plan.id}
                        className="px-3 py-2 bg-green-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {guardandoPrecio === plan.id ? 'Guardando…' : '💾 Guardar'}
                      </button>
                    </div>
                  )
                })}
                {planes.length === 0 && (
                  <p className="text-sm text-gray-400 m-0">No se pudieron cargar los planes.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: ANUNCIOS */}
        {activeTab === 'anuncios' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 m-0">
                📢 Publicá anuncios que todos los usuarios verán al iniciar sesión.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4">Crear nuevo anuncio</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Título:</label>
                  <input
                    type="text"
                    value={nuevoAnuncio.titulo}
                    onChange={(e) => setNuevoAnuncio({...nuevoAnuncio, titulo: e.target.value})}
                    placeholder="Ej: Nueva funcionalidad disponible"
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mensaje:</label>
                  <textarea
                    value={nuevoAnuncio.mensaje}
                    onChange={(e) => setNuevoAnuncio({...nuevoAnuncio, mensaje: e.target.value})}
                    placeholder="Escribí el mensaje del anuncio..."
                    rows={4}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-vertical"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo:</label>
                  <select
                    value={nuevoAnuncio.tipo}
                    onChange={(e) => setNuevoAnuncio({...nuevoAnuncio, tipo: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="info">ℹ️ Información</option>
                    <option value="warning">⚠️ Advertencia</option>
                    <option value="success">✅ Éxito</option>
                    <option value="feature">🚀 Nueva feature</option>
                  </select>
                </div>

                <button
                  onClick={handleCrearAnuncio}
                  disabled={publicando}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-green-600 disabled:opacity-50"
                >
                  {publicando ? 'Publicando…' : '📤 Publicar anuncio'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-bold text-gray-900">Anuncios publicados ({anuncios.length})</h3>
              {anuncios.map(anuncio => (
                <div key={anuncio.id} className={`bg-white rounded-lg border p-4 ${anuncio.activo ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                  {editandoAnuncio?.id === anuncio.id ? (
                    <div className="space-y-3">
                      <input type="text" value={editandoAnuncio.titulo}
                        onChange={(e) => setEditandoAnuncio({ ...editandoAnuncio, titulo: e.target.value })}
                        placeholder="Título" className="w-full p-2 border border-gray-300 rounded-md text-sm" />
                      <textarea value={editandoAnuncio.mensaje} rows={3}
                        onChange={(e) => setEditandoAnuncio({ ...editandoAnuncio, mensaje: e.target.value })}
                        placeholder="Mensaje" className="w-full p-2 border border-gray-300 rounded-md text-sm resize-vertical" />
                      <select value={editandoAnuncio.tipo}
                        onChange={(e) => setEditandoAnuncio({ ...editandoAnuncio, tipo: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm">
                        <option value="info">ℹ️ Info</option>
                        <option value="warning">⚠️ Advertencia</option>
                        <option value="success">✅ Éxito</option>
                        <option value="feature">🚀 Novedad</option>
                      </select>
                      <div className="flex gap-2">
                        <button onClick={handleGuardarEdicion} disabled={guardandoEdicion}
                          className="px-4 py-2 bg-blue-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-600 disabled:opacity-50">
                          {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                        <button onClick={() => setEditandoAnuncio(null)}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">
                        {anuncio.tipo === 'info' ? 'ℹ️' :
                         anuncio.tipo === 'warning' ? '⚠️' :
                         anuncio.tipo === 'success' ? '✅' : '🚀'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900 text-sm mb-1 m-0">{anuncio.titulo}</h4>
                          {!anuncio.activo && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-bold uppercase">Oculto</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{anuncio.mensaje}</p>
                        <div className="text-xs text-gray-500 mt-2">
                          Publicado: {new Date(anuncio.creado_en).toLocaleString('es-AR')}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setEditandoAnuncio({ id: anuncio.id, titulo: anuncio.titulo, mensaje: anuncio.mensaje, tipo: anuncio.tipo })}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold cursor-pointer hover:bg-blue-200">
                            Editar
                          </button>
                          <button onClick={() => handleToggleActivo(anuncio)}
                            className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold cursor-pointer hover:bg-amber-200">
                            {anuncio.activo ? 'Ocultar' : 'Reactivar'}
                          </button>
                          <button onClick={() => setAEliminarAnuncio(anuncio)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold cursor-pointer hover:bg-red-200">
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {anuncios.length === 0 && (
                <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-gray-500 text-sm">No hay anuncios publicados</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: CASHFLOW */}
        {activeTab === 'cashflow' && (() => {
          const MESES_ATRAS = 6
          const MESES_ADELANTE = 6
          const ahora = new Date()

          const pagosPorMes = agruparPagosPorMes(pagosSuscripcion)
          const historico = []
          for (let i = MESES_ATRAS - 1; i >= 0; i--) {
            const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
            const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            historico.push({ mes: clave, real: pagosPorMes[clave] || 0, proyectado: null })
          }

          // La proyección arranca el mes que viene — el actual ya está
          // representado como dato real de arriba, no hay que duplicarlo.
          const proximoMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1)
          const proximoMesISO = `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, '0')}-01`
          const proyeccion = proyectarCashflow(suscripciones, MESES_ADELANTE, proximoMesISO)
          const futuro = Object.entries(proyeccion).map(([mes, monto]) => ({ mes, real: null, proyectado: monto }))

          const datosGrafico = [...historico, ...futuro]
          const total = totalCobradoHistorico(pagosSuscripcion)
          const mrr = mrrActual(suscripciones)

          const nombrePorOwner = (ownerId) => usuarios.find(u => u.id === ownerId)?.nombre || usuarios.find(u => u.id === ownerId)?.email || 'Desconocido'

          return (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 m-0">
                  💰 Lo que ya cobraste, y una proyección de lo que deberías seguir cobrando si nadie
                  cancela ni falla ningún pago — es optimista a propósito, no una garantía.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="text-xs text-gray-500 font-semibold uppercase">Cobrado hasta hoy</div>
                  <div className="text-2xl font-extrabold text-green-700 mt-1">{formatCurrency(total)}</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="text-xs text-gray-500 font-semibold uppercase">Ingreso mensual recurrente (MRR)</div>
                  <div className="text-2xl font-extrabold text-blue-700 mt-1">{formatCurrency(mrr)}</div>
                  <div className="text-xs text-gray-400 mt-1">Suscripciones activas hoy — las anuales cuentan a 1/12</div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-base font-bold text-gray-900 mb-1">Real vs. proyectado, mes a mes</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Barras verdes: lo que ya entró. Barras celestes: lo que se espera si las
                  suscripciones activas de hoy se renuevan sin cortes.
                </p>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={datosGrafico}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => v == null ? '—' : formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="real" name="Cobrado" fill="#16a34a" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="proyectado" name="Proyectado" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-base font-bold text-gray-900 mb-3">Detalle de pagos ({pagosSuscripcion.length})</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {pagosSuscripcion.map(pago => (
                    <div key={pago.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg text-sm">
                      <div>
                        <div className="font-semibold text-gray-800">{nombrePorOwner(pago.owner_id)}</div>
                        <div className="text-xs text-gray-500">
                          {LABEL_SEGMENTO[pago.segmento] || pago.segmento} · {LABEL_CICLO[pago.ciclo] || pago.ciclo} · {formatFecha(pago.procesado_en)}
                        </div>
                      </div>
                      <div className="font-bold text-green-700">{formatCurrency(pago.monto)}</div>
                    </div>
                  ))}
                  {pagosSuscripcion.length === 0 && (
                    <p className="text-gray-500 text-sm m-0">Todavía no hay pagos registrados.</p>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      <ConfirmDialog isOpen={!!confirmarLocal} onClose={() => setConfirmarLocal(null)} onConfirm={confirmarSuspenderLocal}
        danger={!confirmarLocal?.suspendido}
        title={confirmarLocal?.suspendido ? 'Activar local' : 'Suspender local'}
        message={`¿Confirmás ${confirmarLocal?.suspendido ? 'activar' : 'suspender'} "${confirmarLocal?.nombre}"? Esto cambia el estado de su suscripción.`}
        confirmLabel={confirmarLocal?.suspendido ? 'Activar' : 'Suspender'} />

      <ConfirmDialog isOpen={!!confirmarSuscripcion} onClose={() => setConfirmarSuscripcion(null)} onConfirm={confirmarCambioSuscripcion}
        danger={confirmarSuscripcion?.nuevoEstado === 'suspended'}
        title="Cambiar estado de suscripción"
        message={`¿Confirmás cambiar el estado de "${confirmarSuscripcion?.nombreLocal}" a "${confirmarSuscripcion?.nuevoEstado?.toUpperCase()}"?`}
        confirmLabel="Cambiar estado" />

      <ConfirmDialog isOpen={!!aEliminarAnuncio} onClose={() => setAEliminarAnuncio(null)} onConfirm={handleEliminarAnuncio}
        danger
        title="Eliminar anuncio"
        message={`¿Confirmás eliminar "${aEliminarAnuncio?.titulo}"? No se puede deshacer.`}
        confirmLabel="Eliminar" />

      <ConfirmDialog isOpen={!!confirmarEmail} onClose={() => setConfirmarEmail(null)} onConfirm={confirmarCambioEmail}
        danger
        title="Cambiar el email de acceso"
        message={`Esta persona va a dejar de poder entrar con "${confirmarEmail?.emailActual}" y va a tener que usar "${confirmarEmail?.emailNuevo}" de ahora en más. ¿Confirmás?`}
        confirmLabel={guardandoEmail ? 'Guardando…' : 'Sí, cambiar'} />
    </main>
  )
}

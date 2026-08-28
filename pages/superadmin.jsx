import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useUserRole } from '../lib/UserRoleContext'
import { useSignOut } from '../hooks/useSignOut'
import { useSuperAdminData } from '../hooks/useSuperAdminData'
import { cambiarEstadoSuscripcion } from '../lib/services/suscripciones'
import { responderContacto } from '../lib/services/contactos'
import { actualizarUsuario, guardarConfigGlobal } from '../lib/services/superadmin'
import { crearAnuncio } from '../lib/services/anuncios'
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
    config, setConfig, anuncios, loading, recargar,
  } = useSuperAdminData()

  const [activeTab, setActiveTab] = useState('dashboard')

  // Consultas
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [respondiendoId, setRespondiendoId] = useState(null)
  const [respuestaTexto, setRespuestaTexto] = useState('')

  // Usuarios (solo se edita el rol global: el email de login vive en Supabase
  // Auth, no en `perfiles`, y editarlo acá no cambiaba cómo esa persona inicia
  // sesión — solo desincronizaba los dos valores)
  const [editandoUsuario, setEditandoUsuario] = useState(null)
  const [nuevoRol, setNuevoRol] = useState('')

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
      await cambiarEstadoSuscripcion(confirmarSuscripcion.localId, confirmarSuscripcion.nuevoEstado)
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
        <div className="flex gap-2 mb-4 border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'dashboard', label: '📊 Dashboard Global' },
            { id: 'contactos', label: '📬 Consultas' },
            { id: 'usuarios', label: '👥 Usuarios' },
            { id: 'locales', label: '🏪 Locales' },
            { id: 'suscripciones', label: '💳 Suscripciones' },
            { id: 'config', label: '⚙️ Configuración' },
            { id: 'anuncios', label: '📢 Anuncios' }
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
                    ) : (
                      <button
                        onClick={() => { setEditandoUsuario(usuario.id); setNuevoRol(usuario.rol_global) }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-600"
                      >
                        ✏️ Editar rol
                      </button>
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
                            <h4 className="font-bold text-gray-900">{sub.locales?.nombre}</h4>
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
                            <div>📦 Plan: <span className="font-semibold uppercase">{sub.plan}</span></div>
                            <div>📅 Vencimiento: {sub.fecha_vencimiento ? new Date(sub.fecha_vencimiento).toLocaleDateString('es-AR') : 'Sin fecha'}</div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 min-w-[200px]">
                          {sub.estado !== 'active' && (
                            <button
                              onClick={() => setConfirmarSuscripcion({ localId: sub.local_id, nombreLocal: sub.locales?.nombre, nuevoEstado: 'active' })}
                              className="px-3 py-2 bg-green-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-green-600"
                            >
                              ✅ Activar / Desbloquear
                            </button>
                          )}
                          {sub.estado !== 'restricted' && (
                            <button
                              onClick={() => setConfirmarSuscripcion({ localId: sub.local_id, nombreLocal: sub.locales?.nombre, nuevoEstado: 'restricted' })}
                              className="px-3 py-2 bg-amber-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-amber-600"
                            >
                              🟡 Restringir (Solo Reportes)
                            </button>
                          )}
                          {sub.estado !== 'suspended' && (
                            <button
                              onClick={() => setConfirmarSuscripcion({ localId: sub.local_id, nombreLocal: sub.locales?.nombre, nuevoEstado: 'suspended' })}
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
                <div key={anuncio.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">
                      {anuncio.tipo === 'info' ? 'ℹ️' :
                       anuncio.tipo === 'warning' ? '⚠️' :
                       anuncio.tipo === 'success' ? '✅' : '🚀'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 text-sm mb-1">{anuncio.titulo}</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{anuncio.mensaje}</p>
                      <div className="text-xs text-gray-500 mt-2">
                        Publicado: {new Date(anuncio.creado_en).toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>
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
    </main>
  )
}

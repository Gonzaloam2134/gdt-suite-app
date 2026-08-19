import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { formatCurrency } from '../lib/format'
import toast from 'react-hot-toast'

export default function SuperAdmin() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  
  // Stats globales
  const [globalStats, setGlobalStats] = useState({ locales: 0, usuarios: 0, transacciones: 0 })
  
  // Consultas
  const [contactos, setContactos] = useState([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [respondiendoId, setRespondiendoId] = useState(null)
  const [respuestaTexto, setRespuestaTexto] = useState('')
  
  // Usuarios
  const [usuarios, setUsuarios] = useState([])
  const [editandoUsuario, setEditandoUsuario] = useState(null)
  const [nuevoRol, setNuevoRol] = useState('')
  const [nuevoEstado, setNuevoEstado] = useState('')
  
  // Locales
  const [todosLosLocales, setTodosLosLocales] = useState([])
  const [filtroLocal, setFiltroLocal] = useState('')
  
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/'); return }
      
      // Verificar que sea super_user
      const { data: perfil } = await supabase.from('perfiles').select('rol_global').eq('id', session.user.id).maybeSingle()
      if (perfil?.rol_global !== 'super_user') {
        toast.error('No tenés permisos de super administrador')
        router.push('/locales')
        return
      }
      
      setUser(session.user)
      await loadData()
    })
  }, [router])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Stats globales
      const { count: countLocales } = await supabase.from('locales').select('*', { count: 'exact', head: true })
      const { count: countUsuarios } = await supabase.from('perfiles').select('*', { count: 'exact', head: true })
      const { count: countTx } = await supabase.from('transacciones').select('*', { count: 'exact', head: true })
      setGlobalStats({ locales: countLocales || 0, usuarios: countUsuarios || 0, transacciones: countTx || 0 })
      
      // Cargar todas las consultas
      const { data: contactosData } = await supabase
        .from('contactos')
        .select(`
          *,
          perfiles!contactos_user_id_fkey (email, nombre),
          locales (nombre)
        `)
        .order('creado_en', { ascending: false })
      setContactos(contactosData || [])
      
      // Cargar todos los usuarios
      const { data: usuariosData } = await supabase
        .from('perfiles')
        .select(`
          *,
          miembros_locales!inner (local_id, rol, activo, locales(nombre))
        `)
        .order('creado_en', { ascending: false })
      setUsuarios(usuariosData || [])
      
      // Cargar todos los locales
      const { data: localesData } = await supabase
        .from('locales')
        .select(`
          *,
          miembros_locales!inner (user_id, rol, perfiles(email, nombre))
        `)
        .order('creado_en', { ascending: false })
      setTodosLosLocales(localesData || [])
      
    } catch (err) {
      console.error('Error cargando super admin:', err)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleResponderContacto = async (contactoId) => {
    if (!respuestaTexto.trim()) {
      toast.error('Escribí una respuesta')
      return
    }
    try {
      const { error } = await supabase
        .from('contactos')
        .update({
          respuesta: respuestaTexto.trim(),
          estado: 'resuelto',
          respondido_en: new Date().toISOString()
        })
        .eq('id', contactoId)
      
      if (error) throw error
      toast.success('✅ Respuesta enviada')
      setRespondiendoId(null)
      setRespuestaTexto('')
      await loadData()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleActualizarUsuario = async (userId) => {
    if (!nuevoRol && !nuevoEstado) {
      toast.error('Seleccioná al menos un cambio (rol o estado)')
      return
    }
    
    try {
      const updates = {}
      if (nuevoRol) updates.rol_global = nuevoRol
      if (nuevoEstado === 'activo') updates.activo = true
      if (nuevoEstado === 'inactivo') updates.activo = false
      
      const { error } = await supabase.from('perfiles').update(updates).eq('id', userId)
      if (error) throw error
      
      toast.success('✅ Usuario actualizado')
      setEditandoUsuario(null)
      setNuevoRol('')
      setNuevoEstado('')
      await loadData()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleSuspenderLocal = async (localId, estadoActual) => {
    const nuevoEstado = estadoActual === 'activo' ? 'inactivo' : 'activo'
    const accion = nuevoEstado === 'activo' ? 'activar' : 'suspender'
    
    if (!confirm(`¿Estás seguro de ${accion} este local?`)) return
    
    try {
      // Actualizar todos los miembros de ese local
      const { error } = await supabase
        .from('miembros_locales')
        .update({ activo: nuevoEstado === 'activo' })
        .eq('local_id', localId)
      
      if (error) throw error
      toast.success(`✅ Local ${accion === 'activar' ? 'activado' : 'suspendido'} correctamente`)
      await loadData()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p>Cargando panel de super admin...</p></div>
  if (!user) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p>Cargando...</p></div>

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
              onClick={handleSignOut} 
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
            { id: 'locales', label: '🏪 Locales' }
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
                <div className="text-xs text-gray-500 font-semibold mb-2"> LOCALES REGISTRADOS</div>
                <div className="text-3xl font-extrabold text-blue-700">{globalStats.locales}</div>
                <div className="text-xs text-gray-400 mt-1">Total en la plataforma</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-xs text-gray-500 font-semibold mb-2">👥 USUARIOS ACTIVOS</div>
                <div className="text-3xl font-extrabold text-green-700">{globalStats.usuarios}</div>
                <div className="text-xs text-gray-400 mt-1">Cuentas registradas</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-xs text-gray-500 font-semibold mb-2"> TRANSACCIONES</div>
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

            {/* Filtros */}
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

            {/* Lista de consultas */}
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
                            {contacto.tipo_consulta.toUpperCase()}
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
                          <div>👤 {contacto.perfiles?.email || 'Usuario desconocido'}</div>
                          {contacto.locales?.nombre && <div>🏪 {contacto.locales.nombre}</div>}
                          <div>📍 Desde: {contacto.pagina_origen}</div>
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
                👥 Gestioná todos los usuarios de la plataforma. Podés cambiar roles y activar/desactivar cuentas.
              </p>
            </div>

            <div className="space-y-2">
              {usuarios.map(usuario => {
                const esSuperUser = usuario.rol_global === 'super_user'
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
                        
                        {/* Locales asociados */}
                        {usuario.miembros_locales && usuario.miembros_locales.length > 0 && (
                          <div className="text-xs text-gray-600 space-y-1">
                            {usuario.miembros_locales.map((m, idx) => (
                              <div key={idx}>
                                 {m.locales?.nombre} - <span className="font-semibold">{m.rol.toUpperCase()}</span>
                              </div>
                            ))}
                          </div>
                        )}
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
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Estado de la cuenta:</label>
                          <select 
                            value={nuevoEstado || (esActivo ? 'activo' : 'inactivo')} 
                            onChange={(e) => setNuevoEstado(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo (suspendido)</option>
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
                            onClick={() => { setEditandoUsuario(null); setNuevoRol(''); setNuevoEstado('') }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditandoUsuario(usuario.id); setNuevoRol(usuario.rol_global); setNuevoEstado(esActivo ? 'activo' : 'inactivo') }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-600"
                      >
                        ✏️ Editar usuario
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
                 Gestioná todos los locales de la plataforma. Podés suspender locales problemáticos.
              </p>
            </div>

            {/* Buscador */}
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
                  const estaSuspendido = miembrosActivos === 0 && local.miembros_locales?.length > 0
                  
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

                      {/* Miembros del local */}
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
                        onClick={() => handleSuspenderLocal(local.id, estaSuspendido ? 'inactivo' : 'activo')}
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
                <div className="text-5xl mb-3"></div>
                <p className="text-gray-500 text-sm">No se encontraron locales.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

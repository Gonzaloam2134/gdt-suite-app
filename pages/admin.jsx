import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useUserRole } from '../lib/useUserRole'
import { formatCurrency } from '../lib/format'
import toast from 'react-hot-toast'

export default function AdminPanel() {
  const { role, globalRole, userId, loading: roleLoading } = useUserRole()
  const [activeTab, setActiveTab] = useState('resumen')
  const [loading, setLoading] = useState(true)
  
  // Datos globales (super_user)
  const [globalStats, setGlobalStats] = useState({ locales: 0, usuarios: 0, transacciones: 0 })
  const [allLocales, setAllLocales] = useState([])
  
  // Datos de local (owner/cajero/empleado)
  const [localInfo, setLocalInfo] = useState(null)
  const [localStats, setLocalStats] = useState({ ventas: 0, gastos: 0, transacciones: 0 })
  const [miembros, setMiembros] = useState([])
  const [logs, setLogs] = useState([])
  const [misAcciones, setMisAcciones] = useState([])
  
  // Estados para edición de miembros
  const [editingMember, setEditingMember] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [newRole, setNewRole] = useState('')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  
  const router = useRouter()

  useEffect(() => {
    if (roleLoading) return
    
    if (!userId) {
      router.push('/')
      return
    }
    
    if (role === 'empleado') {
      setActiveTab('mis-acciones')
    }
    
    loadData()
  }, [roleLoading, role, userId])

  const loadData = async () => {
    try {
      setLoading(true)
      const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null
      
      console.log('🔍 [Admin] Iniciando carga - role:', role, 'globalRole:', globalRole, 'localId:', activeLocalId)

      // ==========================================
      // SUPER USER: Solo ve estadísticas globales
      // ==========================================
      if (globalRole === 'super_user') {
        const { count: countLocales } = await supabase.from('locales').select('*', { count: 'exact', head: true })
        const { count: countUsuarios } = await supabase.from('perfiles').select('*', { count: 'exact', head: true })
        const { count: countTx } = await supabase.from('transacciones').select('*', { count: 'exact', head: true })
        
        setGlobalStats({
          locales: countLocales || 0,
          usuarios: countUsuarios || 0,
          transacciones: countTx || 0
        })

        const { data: localesData } = await supabase
          .from('locales')
          .select('id, nombre, rubro, creado_en, creado_por')
          .order('creado_en', { ascending: false })
        setAllLocales(localesData || [])
        setActiveTab('resumen')
      }
      
      // ==========================================
      // OWNER: Ve SU local completo
      // ==========================================
      if (role === 'owner') {
        if (!activeLocalId) {
          console.warn('️ No hay local activo seleccionado')
          toast.error('Seleccioná un local primero')
          setLoading(false)
          return
        }

        // Info del local
        const { data: localData } = await supabase
          .from('locales')
          .select('*')
          .eq('id', activeLocalId)
          .maybeSingle()
        setLocalInfo(localData)

        // Estadísticas del local
        const { data: ventasData } = await supabase
          .from('transacciones')
          .select('monto')
          .eq('local_id', activeLocalId)
          .eq('tipo', 'COBRO_RECIBIDO')
        const totalVentas = ventasData?.reduce((sum, v) => sum + (v.monto || 0), 0) || 0

        const { data: gastosData } = await supabase
          .from('transacciones')
          .select('monto')
          .eq('local_id', activeLocalId)
          .eq('tipo', 'GASTO_REGISTRADO')
        const totalGastos = gastosData?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0

        const { count: countTx } = await supabase
          .from('transacciones')
          .select('*', { count: 'exact', head: true })
          .eq('local_id', activeLocalId)

        setLocalStats({
          ventas: totalVentas,
          gastos: totalGastos,
          transacciones: countTx || 0
        })

        // ==========================================
        // CORRECCIÓN DEFINITIVA: Cargar miembros
        // ==========================================
        console.log(' [Admin] Cargando miembros del local:', activeLocalId)
        
        const { data: miembrosData, error: miembrosError } = await supabase
          .from('miembros_locales')
          .select('*')
          .eq('local_id', activeLocalId)
          .eq('activo', true)
        
        console.log('👥 Miembros (raw):', miembrosData, 'Error:', miembrosError)
        
        // Obtener los perfiles de esos usuarios
        const userIds = miembrosData?.map(m => m.user_id) || []
        let miembrosConPerfiles = []
        
        if (userIds.length > 0) {
          console.log('🔍 [Admin] Buscando perfiles para userIds:', userIds)
          
          const { data: perfilesData, error: perfilesError } = await supabase
            .from('perfiles')
            .select('id, email, nombre, rol_global')
            .in('id', userIds)
          
          console.log('📄 Perfiles:', perfilesData, 'Error:', perfilesError)
          
          // Combinar los datos
          miembrosConPerfiles = (miembrosData || []).map(miembro => {
            const perfil = perfilesData?.find(p => p.id === miembro.user_id)
            return {
              ...miembro,
              user: perfil,
              perfiles: perfil
            }
          })
        }
        
        console.log(' Miembros finales:', miembrosConPerfiles)
        setMiembros(miembrosConPerfiles)

        // Logs de auditoría del local
        const { data: logsData } = await supabase
          .from('logs_auditoria')
          .select('*')
          .eq('local_id', activeLocalId)
          .order('creado_en', { ascending: false })
          .limit(50)
        setLogs(logsData || [])
      }
      
      // ==========================================
      // CAJERO: Ve información limitada
      // ==========================================
      if (role === 'cajero') {
        const activeLocalIdCajero = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null
        if (activeLocalIdCajero) {
          const { data: localData } = await supabase
            .from('locales')
            .select('nombre, rubro')
            .eq('id', activeLocalIdCajero)
            .maybeSingle()
          setLocalInfo(localData)

          const { data: misLogs } = await supabase
            .from('logs_auditoria')
            .select('*')
            .eq('local_id', activeLocalIdCajero)
            .eq('user_id', userId)
            .order('creado_en', { ascending: false })
            .limit(30)
          setMisAcciones(misLogs || [])
        }
      }
      
    } catch (err) {
      console.error('❌ Error fatal cargando datos del admin:', err)
      toast.error('Error al cargar el panel: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // FUNCIONES DE GESTIÓN DE MIEMBROS
  // ==========================================
  const handleAgregarMiembro = async () => {
    const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null
    const nombre = document.getElementById('miembro-nombre')?.value
    const email = document.getElementById('miembro-email')?.value
    const rol = document.getElementById('miembro-rol')?.value
    
    if (!nombre || !email) {
      toast.error('Por favor completá nombre y email')
      return
    }
    
    try {
      const { error } = await supabase
        .from('invitaciones')
        .insert([{
          email_invitado: email,
          local_id: activeLocalId,
          rol: rol,
          invitado_por: userId,
          token: crypto.randomUUID(),
          expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          estado: 'pendiente',
          nombre_invitado: nombre
        }])
      
      if (error) throw error
      
      toast.success('✅ Invitación enviada correctamente')
      document.getElementById('miembro-nombre').value = ''
      document.getElementById('miembro-email').value = ''
      await loadData()
    } catch (err) {
      console.error('Error al agregar miembro:', err)
      toast.error('Error al agregar miembro: ' + err.message)
    }
  }

  const handleQuitarMiembro = async (miembroId) => {
    if (!confirm('¿Estás seguro de quitar este miembro del local?')) return
    
    try {
      const { error } = await supabase
        .from('miembros_locales')
        .update({ activo: false })
        .eq('id', miembroId)
      
      if (error) throw error
      
      toast.success('Miembro quitado del local')
      await loadData()
    } catch (err) {
      console.error('Error al quitar miembro:', err)
      toast.error('Error: ' + err.message)
    }
  }

  const handleEditRole = async (miembroId, userIdPerfil, nuevoRol, nuevoNombre, nuevoEmail) => {
    try {
      console.log('🔄 Actualizando miembro:', { miembroId, nuevoRol, nuevoNombre, nuevoEmail })
      
      // 1. Actualizar el rol en miembros_locales
      const { error: miembrosError } = await supabase
        .from('miembros_locales')
        .update({ rol: nuevoRol })
        .eq('id', miembroId)
      
      if (miembrosError) throw miembrosError
      
      // 2. Actualizar nombre, email y rol_global en perfiles
      const { error: perfilError } = await supabase
        .from('perfiles')
        .update({ 
          nombre: nuevoNombre,
          email: nuevoEmail,
          rol_global: nuevoRol 
        })
        .eq('id', userIdPerfil)
      
      if (perfilError) throw perfilError
      
      toast.success('✅ Miembro actualizado correctamente')
      setShowEditModal(false)
      setEditingMember(null)
      
      // Recargar la lista de miembros
      await loadData()
      
    } catch (err) {
      console.error(' Error al actualizar miembro:', err)
      toast.error('Error al actualizar: ' + err.message)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const formatFecha = (fecha) => {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const getAccionLabel = (accion) => {
    const labels = {
      'CAJA_ABIERTA': { icono: '🔓', texto: 'Caja Abierta', color: 'bg-blue-100 text-blue-800' },
      'CAJA_CERRADA': { icono: '🔒', texto: 'Caja Cerrada', color: 'bg-gray-100 text-gray-800' },
      'VENTA_REGISTRADA': { icono: '💰', texto: 'Venta Registrada', color: 'bg-green-100 text-green-800' },
      'GASTO_REGISTRADO': { icono: '💸', texto: 'Gasto Registrado', color: 'bg-red-100 text-red-800' },
      'USUARIO_INVITADO': { icono: '👥', texto: 'Usuario Invitado', color: 'bg-purple-100 text-purple-800' },
      'INVITACION_ACEPTADA': { icono: '✅', texto: 'Invitación Aceptada', color: 'bg-emerald-100 text-emerald-800' },
      'MEDIO_PAGO_CREADO': { icono: '💳', texto: 'Medio de Pago Creado', color: 'bg-amber-100 text-amber-800' },
      'ROL_CAMBIADO': { icono: '🔄', texto: 'Rol Cambiado', color: 'bg-indigo-100 text-indigo-800' }
    }
    return labels[accion] || { icono: '📋', texto: accion, color: 'bg-gray-100 text-gray-800' }
  }

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-slate-400">Cargando panel...</p>
        </div>
      </div>
    )
  }

  // ==========================================
  // RENDER: Super User
  // ==========================================
  if (globalRole === 'super_user') {
    return (
      <main className="min-h-screen bg-slate-900 text-white pb-20">
        <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="m-0 text-xl font-bold text-white">🛡️ Panel de Super Administrador</h1>
              <p className="mt-0.5 text-xs text-slate-400">Vista global del sistema</p>
            </div>
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-md text-white text-xs font-medium cursor-pointer transition-colors">Cerrar Sesión</button>
          </div>
        </header>
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex gap-2 mb-6 border-b border-slate-700">
            {['resumen', 'locales'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold cursor-pointer border-none rounded-t-lg transition-colors ${
                  activeTab === tab ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {tab === 'resumen' ? '📊 Resumen Global' : `🏪 Locales (${allLocales.length})`}
              </button>
            ))}
          </div>
          {activeTab === 'resumen' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-sm font-semibold mb-2">LOCALES REGISTRADOS</div>
                <div className="text-4xl font-extrabold text-blue-400">{globalStats.locales}</div>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-sm font-semibold mb-2">USUARIOS TOTALES</div>
                <div className="text-4xl font-extrabold text-emerald-400">{globalStats.usuarios}</div>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-sm font-semibold mb-2">TRANSACCIONES GLOBALES</div>
                <div className="text-4xl font-extrabold text-purple-400">{globalStats.transacciones}</div>
              </div>
            </div>
          )}
          {activeTab === 'locales' && (
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h2 className="text-lg font-bold mb-4">🏪 Todos los Locales</h2>
              <div className="space-y-3">
                {allLocales.map(local => (
                  <div key={local.id} className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                    <div className="font-bold text-white">{local.nombre}</div>
                    <div className="text-xs text-slate-400 mt-1">{local.rubro} • Creado: {formatFecha(local.creado_en)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    )
  }

  // ==========================================
  // RENDER: Owner
  // ==========================================
  if (role === 'owner') {
    return (
      <main className="min-h-screen bg-slate-100 pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="m-0 text-lg font-bold text-gray-900">👑 Panel de Administración</h1>
              <p className="mt-0.5 text-xs text-gray-500">{localInfo?.nombre || 'Cargando local...'}</p>
            </div>
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer hover:bg-gray-200">Salir</button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-4">
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            {[
              { id: 'resumen', label: '📊 Resumen' },
              { id: 'miembros', label: '👥 Miembros' },
              { id: 'medios-pago', label: '💳 Medios de Pago' },
              { id: 'logs', label: '📋 Auditoría' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-semibold cursor-pointer border-none rounded-t-lg transition-colors ${
                  activeTab === tab.id ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'resumen' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <div className="text-xs text-gray-500 font-semibold mb-1">💰 TOTAL VENTAS</div>
                  <div className="text-2xl font-extrabold text-green-700">{formatCurrency(localStats.ventas)}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <div className="text-xs text-gray-500 font-semibold mb-1">💸 TOTAL GASTOS</div>
                  <div className="text-2xl font-extrabold text-red-700">{formatCurrency(localStats.gastos)}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <div className="text-xs text-gray-500 font-semibold mb-1"> TRANSACCIONES</div>
                  <div className="text-2xl font-extrabold text-blue-700">{localStats.transacciones}</div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <h2 className="m-0 mb-3 text-base font-bold text-gray-900">Últimas Acciones de Auditoría</h2>
                {logs.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin acciones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {logs.slice(0, 10).map(log => {
                      const accionInfo = getAccionLabel(log.accion)
                      return (
                        <div key={log.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${accionInfo.color}`}>{accionInfo.icono}</div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-900">{accionInfo.texto}</div>
                            <div className="text-xs text-gray-500">{formatFecha(log.creado_en)}</div>
                          </div>
                          {log.detalles?.monto && <div className="text-sm font-bold text-gray-700">{formatCurrency(log.detalles.monto)}</div>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'miembros' && (
            <div className="space-y-4">
              {/* Formulario para agregar miembro */}
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <h3 className="text-base font-bold text-gray-900 mb-3">Agregar miembro al local</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" placeholder="Nombre *" className="p-2 border border-gray-300 rounded-lg text-sm" id="miembro-nombre" />
                  <input type="email" placeholder="Email *" className="p-2 border border-gray-300 rounded-lg text-sm" id="miembro-email" />
                  <select className="p-2 border border-gray-300 rounded-lg text-sm" id="miembro-rol">
                    <option value="cajero">👨💼 Cajero</option>
                    <option value="empleado">👷 Empleado</option>
                  </select>
                </div>
                <button onClick={handleAgregarMiembro} className="mt-3 w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">
                  + Enviar Invitación
                </button>
              </div>

              {/* Lista de miembros actuales */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">Miembros actuales ({miembros.length})</h3>
                {miembros.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay miembros registrados.</p>
                ) : (
                  <div className="space-y-2">
                    {miembros.map(miembro => (
                      <div key={miembro.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                            miembro.rol === 'owner' ? 'bg-purple-100' : miembro.rol === 'cajero' ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            {miembro.rol === 'owner' ? '👑' : miembro.rol === 'cajero' ? '‍💼' : '👷'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">
                              {miembro.perfiles?.nombre || miembro.user?.email || 'Usuario'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {miembro.perfiles?.email || miembro.user?.email} • Aceptado: {formatFecha(miembro.aceptado_en)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            miembro.rol === 'owner' ? 'bg-purple-100 text-purple-800' :
                            miembro.rol === 'cajero' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {miembro.rol === 'owner' ? 'Owner' : miembro.rol === 'cajero' ? 'Cajero' : 'Empleado'}
                          </span>
                          {miembro.rol !== 'owner' && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingMember(miembro)
                                  setNewRole(miembro.rol)
                                  setEditName(miembro.perfiles?.nombre || '')
                                  setEditEmail(miembro.perfiles?.email || '')
                                  setShowEditModal(true)
                                }}
                                className="px-3 py-1 bg-amber-100 text-amber-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-amber-200"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => handleQuitarMiembro(miembro.id)}
                                className="px-3 py-1 bg-red-100 text-red-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-red-200"
                              >
                                Quitar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal de Edición de Miembro */}
              {showEditModal && editingMember && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">✏️ Editar Miembro</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Nombre:
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Nombre completo"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Email:
                        </label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="email@ejemplo.com"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Rol:
                        </label>
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="cajero">👨‍💼 Cajero - Opera caja y registra ventas</option>
                          <option value="empleado">👷 Empleado - Solo registra ventas</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => handleEditRole(
                          editingMember.id, 
                          editingMember.user_id || editingMember.perfiles?.id, 
                          newRole, 
                          editName, 
                          editEmail
                        )}
                        className="flex-1 p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600"
                      >
                        💾 Guardar Cambios
                      </button>
                      <button
                        onClick={() => {
                          setShowEditModal(false)
                          setEditingMember(null)
                        }}
                        className="flex-1 p-3 bg-gray-200 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'medios-pago' && (
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <h2 className="m-0 mb-3 text-base font-bold text-gray-900">💳 Medios de Pago</h2>
              <p className="text-sm text-gray-600">Acá iría la gestión de medios de pago (próximamente)</p>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <h2 className="m-0 mb-3 text-base font-bold text-gray-900">📋 Logs de Auditoría</h2>
              {logs.length === 0 ? (
                <p className="text-sm text-gray-500">Sin logs registrados.</p>
              ) : (
                <div className="space-y-2">
                  {logs.map(log => {
                    const accionInfo = getAccionLabel(log.accion)
                    return (
                      <div key={log.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${accionInfo.color}`}>{accionInfo.icono}</div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 text-sm">{accionInfo.texto}</div>
                            <div className="text-xs text-gray-500 mt-1">{formatFecha(log.creado_en)}</div>
                            {log.detalles && (
                              <div className="mt-2 text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                                {log.detalles.descripcion && <div>📝 {log.detalles.descripcion}</div>}
                                {log.detalles.monto && <div>💵 {formatCurrency(log.detalles.monto)}</div>}
                                {log.detalles.email && <div>📧 {log.detalles.email}</div>}
                                {log.detalles.rol_asignado && <div>🎭 Rol asignado: {log.detalles.rol_asignado}</div>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    )
  }

  // ==========================================
  // RENDER: Cajero
  // ==========================================
  if (role === 'cajero') {
    return (
      <main className="min-h-screen bg-slate-100 pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="m-0 text-lg font-bold text-gray-900">👨‍💼 Panel de Cajero</h1>
              <p className="mt-0.5 text-xs text-gray-500">{localInfo?.nombre || 'Mi Local'}</p>
            </div>
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer hover:bg-gray-200">Salir</button>
          </div>
        </header>
        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-amber-800 m-0">ℹ️ Como cajero, podés ver el resumen del local y tus propias acciones.</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 mb-4">
            <h2 className="m-0 mb-3 text-base font-bold text-gray-900">📊 Resumen del Local</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <div className="text-xs text-green-800 font-bold">Total Ventas</div>
                <div className="text-lg font-extrabold text-green-700">{formatCurrency(localStats.ventas)}</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <div className="text-xs text-red-800 font-bold">Total Gastos</div>
                <div className="text-lg font-extrabold text-red-700">{formatCurrency(localStats.gastos)}</div>
              </div>
            </div>
          </div>
          <h3 className="text-sm font-bold text-gray-700 mb-3">Mis Acciones Registradas</h3>
          {misAcciones.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm text-gray-500">Sin acciones registradas aún.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {misAcciones.map(log => {
                const accionInfo = getAccionLabel(log.accion)
                return (
                  <div key={log.id} className="bg-white p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${accionInfo.color}`}>{accionInfo.icono}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">{accionInfo.texto}</div>
                        <div className="text-xs text-gray-500">{formatFecha(log.creado_en)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    )
  }

  // ==========================================
  // RENDER: Empleado
  // ==========================================
  if (role === 'empleado') {
    return (
      <main className="min-h-screen bg-slate-100 pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="m-0 text-lg font-bold text-gray-900">👷 Mis Acciones</h1>
              <p className="mt-0.5 text-xs text-gray-500">Registro de tu actividad</p>
            </div>
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer hover:bg-gray-200">Salir</button>
          </div>
        </header>
        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 m-0">ℹ️ Como empleado, solo podés ver el registro de tus propias acciones.</p>
          </div>
          {misAcciones.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
              <div className="text-5xl mb-3">📭</div>
              <h3 className="m-0 mb-2 text-gray-900 text-base font-bold">Sin acciones registradas</h3>
              <p className="m-0 text-gray-500 text-sm">Aún no tenés acciones en el sistema de auditoría.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {misAcciones.map(log => {
                const accionInfo = getAccionLabel(log.accion)
                return (
                  <div key={log.id} className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${accionInfo.color}`}>{accionInfo.icono}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">{accionInfo.texto}</div>
                        <div className="text-xs text-gray-500 mt-1">{formatFecha(log.creado_en)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    )
  }

  // ==========================================
  // RENDER: Acceso Restringido (Fallback)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl border border-gray-200 text-center max-w-md">
        <div className="text-5xl mb-3"></div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Acceso Restringido</h1>
        <p className="text-sm text-gray-600 mb-2">No tenés permisos para ver este panel.</p>
        <p className="text-xs text-red-500 mb-4 font-mono bg-red-50 p-2 rounded border border-red-200">
          Debug: role=<strong>{role || 'null'}</strong> | globalRole=<strong>{globalRole || 'null'}</strong>
        </p>
        <button onClick={() => router.push('/locales')} className="px-6 py-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">
          Volver a Mis Locales
        </button>
      </div>
    </div>
  )
}

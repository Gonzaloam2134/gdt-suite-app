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
  
  const router = useRouter()

  useEffect(() => {
    if (roleLoading) return
    
    // Si no hay sesión, redirigir al login
    if (!userId) {
      router.push('/')
      return
    }
    
    // Si es empleado, no debería ver el admin (solo sus propias acciones)
    if (role === 'empleado') {
      setActiveTab('mis-acciones')
    }
    
    loadData()
  }, [roleLoading, role, userId])

    const loadData = async () => {
    try {
      setLoading(true)
      const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null
      console.log('🔍 [Admin] Cargando datos para role:', role, 'globalRole:', globalRole, 'localId:', activeLocalId)

      // ==========================================
      // SUPER USER: Ve todo el sistema
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
      }
      
      // ==========================================
      // OWNER: Ve su local completo
      // ==========================================
      if (role === 'owner' || globalRole === 'super_user') {
        if (activeLocalId) {
          console.log('🔍 [Admin] Consultando local:', activeLocalId)
          
          // Info del local
          const { data: localData, error: localError } = await supabase
            .from('locales')
            .select('*')
            .eq('id', activeLocalId)
            .maybeSingle()
          
          if (localError) console.error('❌ Error local:', localError)
          else console.log('✅ Local encontrado:', localData)
          setLocalInfo(localData)

          // Estadísticas del local
          const { data: ventasData, error: ventasError } = await supabase
            .from('transacciones')
            .select('monto')
            .eq('local_id', activeLocalId)
            .eq('tipo', 'COBRO_RECIBIDO')
          
          if (ventasError) console.error('❌ Error ventas:', ventasError)
          else console.log('✅ Ventas encontradas:', ventasData?.length, 'filas')
          
          const totalVentas = ventasData?.reduce((sum, v) => sum + v.monto, 0) || 0

          const { data: gastosData, error: gastosError } = await supabase
            .from('transacciones')
            .select('monto')
            .eq('local_id', activeLocalId)
            .eq('tipo', 'GASTO_REGISTRADO')
          
          if (gastosError) console.error('❌ Error gastos:', gastosError)
          
          const totalGastos = gastosData?.reduce((sum, g) => sum + g.monto, 0) || 0

          const { count: countTx, error: countError } = await supabase
            .from('transacciones')
            .select('*', { count: 'exact', head: true })
            .eq('local_id', activeLocalId)

          if (countError) console.error('❌ Error count:', countError)
          else console.log('✅ Total transacciones:', countTx)

          setLocalStats({
            ventas: totalVentas,
            gastos: totalGastos,
            transacciones: countTx || 0
          })

          // Miembros del local
          const { data: miembrosData } = await supabase
            .from('miembros_locales')
            .select(`
              id, rol, activo, aceptado_en,
              user:auth.users(id, email)
            `)
            .eq('local_id', activeLocalId)
            .eq('activo', true)
          setMiembros(miembrosData || [])

          // Logs de auditoría del local
          const { data: logsData } = await supabase
            .from('logs_auditoria')
            .select('*')
            .eq('local_id', activeLocalId)
            .order('creado_en', { ascending: false })
            .limit(50)
          setLogs(logsData || [])
        }
      }
      
      // ==========================================
      // CAJERO: Ve información limitada
      // ==========================================
      if (role === 'cajero') {
        if (activeLocalId) {
          const { data: localData } = await supabase
            .from('locales')
            .select('nombre, rubro')
            .eq('id', activeLocalId)
            .maybeSingle()
          setLocalInfo(localData)

          const { data: misLogs } = await supabase
            .from('logs_auditoria')
            .select('*')
            .eq('local_id', activeLocalId)
            .eq('user_id', userId)
            .order('creado_en', { ascending: false })
            .limit(30)
          setMisAcciones(misLogs || [])
        }
      }
      
    } catch (err) {
      console.error('❌ Error fatal cargando datos del admin:', err)
      toast.error('Error al cargar el panel')
    } finally {
      setLoading(false)
    }
  }

        const { data: localesData } = await supabase
          .from('locales')
          .select('id, nombre, rubro, creado_en, creado_por')
          .order('creado_en', { ascending: false })
        setAllLocales(localesData || [])
      }
      
      // ==========================================
      // OWNER: Ve su local completo
      // ==========================================
      if (role === 'owner' || globalRole === 'super_user') {
        const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null
        
        if (activeLocalId) {
          // Info del local
          const { data: localData } = await supabase
            .from('locales')
            .select('*')
            .eq('id', activeLocalId)
            .single()
          setLocalInfo(localData)

          // Estadísticas del local
          const { data: ventasData } = await supabase
            .from('transacciones')
            .select('monto')
            .eq('local_id', activeLocalId)
            .eq('tipo', 'COBRO_RECIBIDO')
          const totalVentas = ventasData?.reduce((sum, v) => sum + v.monto, 0) || 0

          const { data: gastosData } = await supabase
            .from('transacciones')
            .select('monto')
            .eq('local_id', activeLocalId)
            .eq('tipo', 'GASTO_REGISTRADO')
          const totalGastos = gastosData?.reduce((sum, g) => sum + g.monto, 0) || 0

          const { count: countTx } = await supabase
            .from('transacciones')
            .select('*', { count: 'exact', head: true })
            .eq('local_id', activeLocalId)

          setLocalStats({
            ventas: totalVentas,
            gastos: totalGastos,
            transacciones: countTx || 0
          })

          // Miembros del local
          const { data: miembrosData } = await supabase
            .from('miembros_locales')
            .select(`
              id, rol, activo, aceptado_en,
              user:auth.users(id, email)
            `)
            .eq('local_id', activeLocalId)
            .eq('activo', true)
          setMiembros(miembrosData || [])

          // Logs de auditoría del local
          const { data: logsData } = await supabase
            .from('logs_auditoria')
            .select('*')
            .eq('local_id', activeLocalId)
            .order('creado_en', { ascending: false })
            .limit(50)
          setLogs(logsData || [])
        }
      }
      
      // ==========================================
      // CAJERO: Ve información limitada
      // ==========================================
      if (role === 'cajero') {
        const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null
        
        if (activeLocalId) {
          // Info básica del local
          const { data: localData } = await supabase
            .from('locales')
            .select('nombre, rubro')
            .eq('id', activeLocalId)
            .single()
          setLocalInfo(localData)

          // Sus propias acciones en los logs
          const { data: misLogs } = await supabase
            .from('logs_auditoria')
            .select('*')
            .eq('local_id', activeLocalId)
            .eq('user_id', userId)
            .order('creado_en', { ascending: false })
            .limit(30)
          setMisAcciones(misLogs || [])
        }
      }
      
    } catch (err) {
      console.error('Error cargando datos del admin:', err)
      toast.error('Error al cargar el panel')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // ==========================================
  // HELPERS DE FORMATO
  // ==========================================
  const formatFecha = (fecha) => {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
      'ROL_CAMBIADO': { icono: '', texto: 'Rol Cambiado', color: 'bg-indigo-100 text-indigo-800' }
    }
    return labels[accion] || { icono: '📋', texto: accion, color: 'bg-gray-100 text-gray-800' }
  }

  // ==========================================
  // RENDER: Pantalla de carga
  // ==========================================
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
  // RENDER: Empleado (solo ve sus acciones)
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
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer">Salir</button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 m-0">
              ℹ️ Como empleado, solo podés ver el registro de tus propias acciones.
            </p>
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
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${accionInfo.color}`}>
                        {accionInfo.icono}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">{accionInfo.texto}</div>
                        <div className="text-xs text-gray-500 mt-1">{formatFecha(log.creado_en)}</div>
                        {log.detalles && (
                          <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                            {log.detalles.descripcion && <div>📝 {log.detalles.descripcion}</div>}
                            {log.detalles.monto && <div>💵 {formatCurrency(log.detalles.monto)}</div>}
                            {log.detalles.email && <div> {log.detalles.email}</div>}
                            {log.detalles.rol_asignado && <div>🎭 Rol: {log.detalles.rol_asignado}</div>}
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
      </main>
    )
  }

  // ==========================================
  // RENDER: Cajero (información limitada)
  // ==========================================
  if (role === 'cajero') {
    return (
      <main className="min-h-screen bg-slate-100 pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="m-0 text-lg font-bold text-gray-900">‍💼 Panel de Cajero</h1>
              <p className="mt-0.5 text-xs text-gray-500">{localInfo?.nombre || 'Mi Local'}</p>
            </div>
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer">Salir</button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-amber-800 m-0">
              ℹ️ Como cajero, podés ver el resumen del local y tus propias acciones.
            </p>
          </div>

          {/* Resumen del local */}
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

          {/* Mis acciones */}
          <h3 className="text-sm font-bold text-gray-700 mb-3"> Mis Acciones Registradas</h3>
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
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${accionInfo.color}`}>
                        {accionInfo.icono}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">{accionInfo.texto}</div>
                        <div className="text-xs text-gray-500">{formatFecha(log.creado_en)}</div>
                      </div>
                    </div>
                    {log.detalles && (
                      <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        {log.detalles.descripcion && <div>📝 {log.detalles.descripcion}</div>}
                        {log.detalles.monto && <div>💵 {formatCurrency(log.detalles.monto)}</div>}
                      </div>
                    )}
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
  // RENDER: Owner (ve todo su local)
  // ==========================================
  if (role === 'owner') {
    return (
      <main className="min-h-screen bg-slate-100 pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="m-0 text-lg font-bold text-gray-900">👑 Panel de Administración</h1>
              <p className="mt-0.5 text-xs text-gray-500">{localInfo?.nombre || 'Mi Local'}</p>
            </div>
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer">Salir</button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-4">
          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            {[
              { id: 'resumen', label: '📊 Resumen' },
              { id: 'miembros', label: '👥 Miembros' },
              { id: 'logs', label: '📋 Auditoría' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-semibold cursor-pointer border-none rounded-t-lg transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB: Resumen */}
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
                  <div className="text-xs text-gray-500 font-semibold mb-1">📊 TRANSACCIONES</div>
                  <div className="text-2xl font-extrabold text-blue-700">{localStats.transacciones}</div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <h2 className="m-0 mb-3 text-base font-bold text-gray-900">📋 Últimas Acciones de Auditoría</h2>
                {logs.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin acciones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {logs.slice(0, 10).map(log => {
                      const accionInfo = getAccionLabel(log.accion)
                      return (
                        <div key={log.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${accionInfo.color}`}>
                            {accionInfo.icono}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-900">{accionInfo.texto}</div>
                            <div className="text-xs text-gray-500">{formatFecha(log.creado_en)}</div>
                          </div>
                          {log.detalles?.monto && (
                            <div className="text-sm font-bold text-gray-700">{formatCurrency(log.detalles.monto)}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Miembros */}
          {activeTab === 'miembros' && (
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <h2 className="m-0 mb-3 text-base font-bold text-gray-900">👥 Miembros del Local</h2>
              {miembros.length === 0 ? (
                <p className="text-sm text-gray-500">No hay miembros registrados.</p>
              ) : (
                <div className="space-y-2">
                  {miembros.map(miembro => (
                    <div key={miembro.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{miembro.user?.email || 'Usuario'}</div>
                        <div className="text-xs text-gray-500">
                          Aceptado: {formatFecha(miembro.aceptado_en)}
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                        miembro.rol === 'owner' ? 'bg-purple-100 text-purple-800' :
                        miembro.rol === 'cajero' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {miembro.rol === 'owner' ? '👑 Owner' :
                         miembro.rol === 'cajero' ? '👨‍💼 Cajero' : '👷 Empleado'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Logs de Auditoría */}
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
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${accionInfo.color}`}>
                            {accionInfo.icono}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 text-sm">{accionInfo.texto}</div>
                            <div className="text-xs text-gray-500 mt-1">{formatFecha(log.creado_en)}</div>
                            {log.detalles && (
                              <div className="mt-2 text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                                {log.detalles.descripcion && <div>📝 {log.detalles.descripcion}</div>}
                                {log.detalles.monto && <div>💵 {formatCurrency(log.detalles.monto)}</div>}
                                {log.detalles.email && <div>📧 {log.detalles.email}</div>}
                                {log.detalles.rol_asignado && <div> Rol asignado: {log.detalles.rol_asignado}</div>}
                                {log.detalles.monto_inicial && <div>💰 Monto inicial: {formatCurrency(log.detalles.monto_inicial)}</div>}
                                {log.detalles.motivo_diferencia && <div>️ {log.detalles.motivo_diferencia}</div>}
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
  // RENDER: Super User (ve todo el sistema)
  // ==========================================
  if (globalRole === 'super_user') {
    return (
      <main className="min-h-screen bg-slate-900 text-white pb-20">
        <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="m-0 text-xl font-bold text-white"> Panel de Super Administrador</h1>
              <p className="mt-0.5 text-xs text-slate-400">Vista global del sistema</p>
            </div>
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-md text-white text-xs font-medium cursor-pointer transition-colors">Cerrar Sesión</button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-slate-700">
            {[
              { id: 'resumen', label: '📊 Resumen Global' },
              { id: 'locales', label: '🏪 Locales' },
              { id: 'logs', label: '📋 Auditoría Global' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-semibold cursor-pointer border-none rounded-t-lg transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-400' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB: Resumen Global */}
          {activeTab === 'resumen' && (
            <div className="space-y-6">
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

              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h2 className="text-lg font-bold mb-4"> Estado del Sistema</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                    <span className="text-slate-300 text-sm">Base de datos</span>
                    <span className="text-emerald-400 text-sm font-bold">✅ Conectada</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                    <span className="text-slate-300 text-sm">Sistema de roles</span>
                    <span className="text-emerald-400 text-sm font-bold">✅ Activo</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                    <span className="text-slate-300 text-sm">Logs de auditoría</span>
                    <span className="text-emerald-400 text-sm font-bold">✅ Registrando</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Locales */}
          {activeTab === 'locales' && (
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h2 className="text-lg font-bold mb-4">🏪 Todos los Locales</h2>
              {allLocales.length === 0 ? (
                <p className="text-slate-400 text-sm">No hay locales registrados.</p>
              ) : (
                <div className="space-y-3">
                  {allLocales.map(local => (
                    <div key={local.id} className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-white">{local.nombre}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            {local.rubro && <span className="bg-slate-700 px-2 py-0.5 rounded mr-2">{local.rubro}</span>}
                            Creado: {formatFecha(local.creado_en)}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{local.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Logs Globales */}
          {activeTab === 'logs' && (
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h2 className="text-lg font-bold mb-4">📋 Auditoría Global</h2>
              <p className="text-slate-400 text-sm mb-4">
                Los logs de auditoría se muestran por local. Seleccioná un local para ver sus logs.
              </p>
              <div className="space-y-3">
                {allLocales.slice(0, 5).map(local => (
                  <div key={local.id} className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                    <div className="font-bold text-white">{local.nombre}</div>
                    <div className="text-xs text-slate-400 mt-1">ID: {local.id}</div>
                    <button className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold cursor-pointer transition-colors">
                      Ver logs de este local
                    </button>
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
  // RENDER: Fallback (rol no reconocido)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
        <div className="text-5xl mb-3">🚫</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Acceso Restringido</h1>
        <p className="text-sm text-gray-600 mb-4">No tenés permisos para ver este panel.</p>
        <button 
          onClick={() => router.push('/dashboard')}
          className="px-6 py-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer"
        >
          Volver al Dashboard
        </button>
      </div>
    </div>
  )
}

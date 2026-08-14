import { supabase } from '../lib/supabaseClient'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useUserRole } from '../lib/useUserRole'
import { formatCurrency } from '../lib/format'
import toast from 'react-hot-toast'

export default function AdminPanel() {
  const { role, globalRole, userId, loading: roleLoading } = useUserRole()
  const [activeTab, setActiveTab] = useState('resumen')
  const [loading, setLoading] = useState(true)
  
  const [globalStats, setGlobalStats] = useState({ locales: 0, usuarios: 0, transacciones: 0 })
  const [allLocales, setAllLocales] = useState([])
  
  const [localInfo, setLocalInfo] = useState(null)
  const [localStats, setLocalStats] = useState({ ventas: 0, gastos: 0, transacciones: 0 })
  const [miembros, setMiembros] = useState([])
  const [logs, setLogs] = useState([])
  const [misAcciones, setMisAcciones] = useState([])
  const [empleadosPendientes, setEmpleadosPendientes] = useState([])
  
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [ordenColumna, setOrdenColumna] = useState('creado_en')
  const [ordenDireccion, setOrdenDireccion] = useState('desc')
  
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
      
      if (globalRole === 'super_user') {
        const { count: countLocales } = await supabase.from('locales').select('*', { count: 'exact', head: true })
        const { count: countUsuarios } = await supabase.from('perfiles').select('*', { count: 'exact', head: true })
        const { count: countTx } = await supabase.from('transacciones').select('*', { count: 'exact', head: true })
        
        setGlobalStats({ locales: countLocales || 0, usuarios: countUsuarios || 0, transacciones: countTx || 0 })

        const { data: localesData } = await supabase
          .from('locales')
          .select('id, nombre, rubro, creado_en, creado_por')
          .order('creado_en', { ascending: false })
        setAllLocales(localesData || [])
      }
      
      if (role === 'owner' || globalRole === 'super_user') {
        if (activeLocalId) {
          const { data: localData } = await supabase.from('locales').select('*').eq('id', activeLocalId).maybeSingle()
          setLocalInfo(localData)

          const { data: ventasData } = await supabase.from('transacciones').select('monto').eq('local_id', activeLocalId).eq('tipo', 'COBRO_RECIBIDO')
          const totalVentas = ventasData?.reduce((sum, v) => sum + v.monto, 0) || 0

          const { data: gastosData } = await supabase.from('transacciones').select('monto').eq('local_id', activeLocalId).eq('tipo', 'GASTO_REGISTRADO')
          const totalGastos = gastosData?.reduce((sum, g) => sum + g.monto, 0) || 0

          const { count: countTx } = await supabase.from('transacciones').select('*', { count: 'exact', head: true }).eq('local_id', activeLocalId)
          setLocalStats({ ventas: totalVentas, gastos: totalGastos, transacciones: countTx || 0 })

          // Cargar miembros
          const { data: membresiasData } = await supabase
            .from('miembros_locales')
            .select('id, rol, activo, aceptado_en, user_id')
            .eq('local_id', activeLocalId)
            .eq('activo', true)
          
          let emailMap = {}
          if (membresiasData && membresiasData.length > 0) {
            const userIds = membresiasData.map(m => m.user_id)
            const { data: perfilesData } = await supabase.from('perfiles').select('id, email, nombre').in('id', userIds)
            if (perfilesData) {
              perfilesData.forEach(p => { emailMap[p.id] = { email: p.email, nombre: p.nombre } })
            }
          }
          
          const miembrosConInfo = (membresiasData || []).map(m => {
            const info = emailMap[m.user_id] || {}
            return {
              ...m,
              user: { 
                email: info.email || 'Sin email',
                nombre: info.nombre,
                displayName: info.nombre || info.email || 'Usuario'
              }
            }
          })
          setMiembros(miembrosConInfo)

          // Cargar empleados pendientes
          const { data: pendientesData } = await supabase
            .from('empleados_pendientes')
            .select('*')
            .eq('local_id', activeLocalId)
            .eq('estado', 'pendiente')
            .order('creado_en', { ascending: false })
          setEmpleadosPendientes(pendientesData || [])

          // Cargar logs y transacciones
          const { data: logsData } = await supabase.from('logs_auditoria').select('*').eq('local_id', activeLocalId).order('creado_en', { ascending: false }).limit(200)
          const { data: transaccionesData } = await supabase.from('transacciones').select('id, local_id, tipo, monto, comision_monto, descripcion, creado_por, creado_en, medio_pago_id').eq('local_id', activeLocalId).order('creado_en', { ascending: false }).limit(200)
          
          const { data: mediosPagoData } = await supabase.from('medios_pago').select('id, nombre').eq('local_id', activeLocalId)
          const mediosMap = {}
          if (mediosPagoData) mediosPagoData.forEach(mp => { mediosMap[mp.id] = mp.nombre })
          
          const allUserIds = new Set()
          if (logsData) logsData.forEach(l => { if (l.user_id) allUserIds.add(l.user_id) })
          if (transaccionesData) transaccionesData.forEach(t => { if (t.creado_por) allUserIds.add(t.creado_por) })
          
          let fullEmailMap = { ...emailMap }
          if (allUserIds.size > 0) {
            const { data: perfilesData } = await supabase.from('perfiles').select('id, email').in('id', Array.from(allUserIds))
            if (perfilesData) perfilesData.forEach(p => { fullEmailMap[p.id] = { email: p.email } })
          }
          
          const logsConTransacciones = []
          if (logsData) {
            logsData.forEach(log => {
              const info = fullEmailMap[log.user_id] || {}
              logsConTransacciones.push({ ...log, user_email: info.email || 'Sistema', esTransaccion: false })
            })
          }
          if (transaccionesData) {
            transaccionesData.forEach(tx => {
              const info = fullEmailMap[tx.creado_por] || {}
              logsConTransacciones.push({
                id: `tx_${tx.id}`,
                local_id: tx.local_id,
                user_id: tx.creado_por,
                user_email: info.email || 'Sistema',
                accion: tx.tipo === 'COBRO_RECIBIDO' ? 'VENTA_REGISTRADA' : 'GASTO_REGISTRADO',
                detalles: { descripcion: tx.descripcion, monto: tx.monto, medio_pago: mediosMap[tx.medio_pago_id] || 'N/A', comision: tx.comision_monto },
                creado_en: tx.creado_en,
                esTransaccion: true
              })
            })
          }
          
          logsConTransacciones.sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
          setLogs(logsConTransacciones)
        }
      }
      
      if (role === 'cajero') {
        if (activeLocalId) {
          const { data: localData } = await supabase.from('locales').select('nombre, rubro').eq('id', activeLocalId).maybeSingle()
          setLocalInfo(localData)
          const { data: misLogs } = await supabase.from('logs_auditoria').select('*').eq('local_id', activeLocalId).eq('user_id', userId).order('creado_en', { ascending: false }).limit(30)
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

  const handleActivarEmpleado = async (empleadoId, email) => {
    try {
      const empleado = empleadosPendientes.find(e => e.id === empleadoId)
      if (!empleado) {
        toast.error('Empleado no encontrado')
        return
      }

      const tempPassword = 'Temp' + Math.random().toString(36).slice(-8)

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: tempPassword,
        options: {
          data: { nombre: empleado.nombre }
        }
      })

      if (authError) throw authError

      await supabase.from('perfiles').insert({
        id: authData.user.id,
        email: email,
        nombre: empleado.nombre,
        rol_global: empleado.rol
      })

      const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null
      await supabase.from('miembros_locales').insert({
        local_id: activeLocalId,
        user_id: authData.user.id,
        rol: empleado.rol,
        activo: true,
        aceptado_en: new Date().toISOString()
      })

      await supabase.from('empleados_pendientes').update({
        email: email,
        user_id: authData.user.id,
        estado: 'activo'
      }).eq('id', empleadoId)

await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: window.location.origin + '/recuperar-password'
})

      toast.success(`✅ ${empleado.nombre} activado. Email enviado a ${email}`)
      loadData()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleEliminarPendiente = async (empleadoId) => {
    if (!confirm('¿Eliminar este empleado pendiente?')) return
    try {
      const { error } = await supabase.from('empleados_pendientes').delete().eq('id', empleadoId)
      if (error) throw error
      toast.success('Empleado pendiente eliminado')
      loadData()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const formatFecha = (fecha) => {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getAccionLabel = (accion) => {
    const labels = {
      'CAJA_ABIERTA': { icono: '🔓', texto: 'Caja Abierta', color: 'bg-blue-100 text-blue-800' },
      'CAJA_CERRADA': { icono: '🔒', texto: 'Caja Cerrada', color: 'bg-gray-100 text-gray-800' },
      'VENTA_REGISTRADA': { icono: '💰', texto: 'Venta Registrada', color: 'bg-green-100 text-green-800' },
      'GASTO_REGISTRADO': { icono: '💸', texto: 'Gasto Registrado', color: 'bg-red-100 text-red-800' },
      'USUARIO_INVITADO': { icono: '', texto: 'Usuario Invitado', color: 'bg-purple-100 text-purple-800' },
      'INVITACION_ACEPTADA': { icono: '✅', texto: 'Invitación Aceptada', color: 'bg-emerald-100 text-emerald-800' }
    }
    return labels[accion] || { icono: '📝', texto: accion, color: 'bg-gray-100 text-gray-800' }
  }

  const getTipoOperacion = (log) => {
    if (log.accion === 'VENTA_REGISTRADA') return 'Venta'
    if (log.accion === 'GASTO_REGISTRADO') return 'Gasto'
    if (log.accion === 'CAJA_ABIERTA') return 'Apertura'
    if (log.accion === 'CAJA_CERRADA') return 'Cierre'
    return log.accion
  }

  const logsFiltrados = useMemo(() => {
    let resultado = [...logs]
    if (filtroTipo !== 'todos') resultado = resultado.filter(log => getTipoOperacion(log) === filtroTipo)
    if (filtroFechaDesde) {
      const desde = new Date(filtroFechaDesde)
      resultado = resultado.filter(log => new Date(log.creado_en) >= desde)
    }
    if (filtroFechaHasta) {
      const hasta = new Date(filtroFechaHasta)
      hasta.setHours(23, 59, 59)
      resultado = resultado.filter(log => new Date(log.creado_en) <= hasta)
    }
    if (filtroUsuario) {
      resultado = resultado.filter(log => log.user_email?.toLowerCase().includes(filtroUsuario.toLowerCase()))
    }
    resultado.sort((a, b) => {
      let valorA, valorB
      if (ordenColumna === 'creado_en') { valorA = new Date(a.creado_en); valorB = new Date(b.creado_en) }
      else if (ordenColumna === 'tipo') { valorA = getTipoOperacion(a); valorB = getTipoOperacion(b) }
      else if (ordenColumna === 'usuario') { valorA = a.user_email || ''; valorB = b.user_email || '' }
      else if (ordenColumna === 'concepto') { valorA = a.detalles?.descripcion || ''; valorB = b.detalles?.descripcion || '' }
      else if (ordenColumna === 'monto') { valorA = a.detalles?.monto || 0; valorB = b.detalles?.monto || 0 }
      
      if (valorA < valorB) return ordenDireccion === 'asc' ? -1 : 1
      if (valorA > valorB) return ordenDireccion === 'asc' ? 1 : -1
      return 0
    })
    return resultado
  }, [logs, filtroTipo, filtroFechaDesde, filtroFechaHasta, filtroUsuario, ordenColumna, ordenDireccion])

  const handleOrdenamiento = (columna) => {
    if (ordenColumna === columna) setOrdenDireccion(ordenDireccion === 'asc' ? 'desc' : 'asc')
    else { setOrdenColumna(columna); setOrdenDireccion('desc') }
  }

  const exportarCSV = () => {
    const headers = ['Fecha/Hora', 'Tipo', 'Usuario', 'Concepto', 'Medio de Pago', 'Monto', 'Comisión']
    const rows = logsFiltrados.map(log => [
      new Date(log.creado_en).toLocaleString('es-AR'),
      getTipoOperacion(log),
      log.user_email || 'Sistema',
      log.detalles?.descripcion || '-',
      log.detalles?.medio_pago || '-',
      log.detalles?.monto ? log.detalles.monto.toFixed(2) : '-',
      log.detalles?.comision ? log.detalles.comision.toFixed(2) : '-'
    ])
    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const limpiarFiltros = () => {
    setFiltroTipo('todos'); setFiltroFechaDesde(''); setFiltroFechaHasta(''); setFiltroUsuario('')
    setOrdenColumna('creado_en'); setOrdenDireccion('desc')
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
          {misAcciones.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
              <div className="text-5xl mb-3">📭</div>
              <h3 className="m-0 mb-2 text-gray-900 text-base font-bold">Sin acciones registradas</h3>
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
                        {log.detalles && (
                          <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                            {log.detalles.descripcion && <div> {log.detalles.descripcion}</div>}
                            {log.detalles.monto && <div>💰 {formatCurrency(log.detalles.monto)}</div>}
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

  if (role === 'cajero') {
    return (
      <main className="min-h-screen bg-slate-100 pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="m-0 text-lg font-bold text-gray-900">👨‍💼 Panel de Cajero</h1>
              <p className="mt-0.5 text-xs text-gray-500">{localInfo?.nombre || 'Mi Local'}</p>
            </div>
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer">Salir</button>
          </div>
        </header>
        <div className="max-w-4xl mx-auto p-4">
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

  if (role === 'owner' || globalRole === 'super_user') {
    return (
      <main className="min-h-screen bg-slate-100 pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/dashboard')} className="px-3 py-1.5 bg-blue-500 text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-600">← Caja</button>
              <div>
                <h1 className="m-0 text-lg font-bold text-gray-900">👑 Panel de Administración</h1>
                <p className="mt-0.5 text-xs text-gray-500">{localInfo?.nombre || 'Mi Local'}</p>
              </div>
            </div>
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer">Salir</button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-4">
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            {[
              { id: 'resumen', label: ' Resumen' }, 
              { id: 'miembros', label: `👥 Miembros${empleadosPendientes.length > 0 ? ` (${empleadosPendientes.length} pendientes)` : ''}` }, 
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
            </div>
          )}

          {activeTab === 'miembros' && (
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h2 className="m-0 mb-4 text-lg font-bold text-gray-900">👥 Gestión de Miembros</h2>
              
              {/* Empleados pendientes */}
              {empleadosPendientes.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-lg mb-6 border-2 border-yellow-300">
                  <h3 className="m-0 mb-3 text-sm font-bold text-yellow-900">
                     Empleados pendientes de email ({empleadosPendientes.length})
                  </h3>
                  <div className="space-y-2">
                    {empleadosPendientes.map(emp => (
                      <div key={emp.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-yellow-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-lg">
                            {emp.rol === 'cajero' ? '👨💼' : '👷'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">{emp.nombre}</div>
                            <div className="text-xs text-yellow-700">
                              {emp.rol === 'cajero' ? 'Cajero' : 'Empleado'} - Pendiente de email
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const email = prompt(`Ingresá el email para ${emp.nombre}:`)
                              if (email && email.includes('@')) {
                                handleActivarEmpleado(emp.id, email)
                              } else if (email) {
                                toast.error('Email inválido')
                              }
                            }}
                            className="px-3 py-1 bg-green-600 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-green-700"
                          >
                             Asociar email
                          </button>
                          <button
                            onClick={() => handleEliminarPendiente(emp.id)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-red-200"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agregar miembro (nombre + rol, email opcional) */}
<div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
  <h3 className="m-0 mb-3 text-sm font-bold text-blue-900"> Agregar miembro al local</h3>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
    <input 
      type="text"
      placeholder="Nombre del empleado *"
      className="p-2 border border-gray-300 rounded-md text-sm" 
      id="nuevoMiembroNombre" 
    />
    <select className="p-2 border border-gray-300 rounded-md text-sm" id="nuevoMiembroRol">
      <option value="cajero">👨‍💼 Cajero</option>
      <option value="empleado">👷 Empleado</option>
      <option value="owner">👑 Owner</option>
    </select>
    <input 
      type="email"
      placeholder="Email (opcional)"
      className="p-2 border border-gray-300 rounded-md text-sm" 
      id="nuevoMiembroEmail" 
    />
    <button
      onClick={async () => {
        const nombreInput = document.getElementById('nuevoMiembroNombre')
        const rolInput = document.getElementById('nuevoMiembroRol')
        const emailInput = document.getElementById('nuevoMiembroEmail')
        
        if (!nombreInput || !rolInput || !emailInput) return
        
        const nombre = nombreInput.value.trim()
        const rol = rolInput.value
        const email = emailInput.value.trim()
        
        if (!nombre) { 
          toast.error('El nombre es obligatorio')
          return 
        }

        try {
          const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

          // Si hay email, crear usuario completo
          if (email) {
            const tempPassword = 'Temp' + Math.random().toString(36).slice(-8)

            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: email,
              password: tempPassword,
              options: { data: { nombre: nombre } }
            })

            if (authError) throw authError

            await supabase.from('perfiles').insert({
              id: authData.user.id,
              email: email,
              nombre: nombre,
              rol_global: rol
            })

            await supabase.from('miembros_locales').insert({
              local_id: activeLocalId,
              user_id: authData.user.id,
              rol: rol,
              activo: true,
              aceptado_en: new Date().toISOString()
            })

            await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin + '/dashboard'
            })

            toast.success(`✅ ${nombre} agregado como ${rol}. Email enviado a ${email}`)
          } else {
            // Sin email: crear empleado pendiente
            await supabase.from('empleados_pendientes').insert({
              local_id: activeLocalId,
              nombre: nombre,
              rol: rol,
              creado_por: userId,
              estado: 'pendiente'
            })

            toast.success(`✅ ${nombre} agregado como ${rol}. Pendiente de email.`)
          }

          nombreInput.value = ''
          emailInput.value = ''
          loadData()
        } catch (err) {
          toast.error('Error: ' + err.message)
        }
      }}
      className="p-2 bg-blue-600 text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-blue-700"
    >
      Agregar al local
    </button>
  </div>
  <p className="m-0 mt-2 text-xs text-blue-700">
    💡 Si no ingresás email, el empleado quedará pendiente. Podrás asociar el email después desde la sección de arriba.
  </p>
</div>

              {/* Lista de miembros actuales */}
              <h3 className="m-0 mb-3 text-sm font-bold text-gray-700">Miembros actuales ({miembros.length})</h3>
              {miembros.length === 0 ? (
                <p className="text-sm text-gray-500">No hay miembros registrados.</p>
              ) : (
                <div className="space-y-2">
                  {miembros.map(miembro => (
                    <div key={miembro.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg">
                          {miembro.rol === 'owner' ? '👑' : miembro.rol === 'cajero' ? '👨‍' : '👷'}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{miembro.user?.displayName || 'Usuario'}</div>
                          <div className="text-xs text-gray-500">
                            {miembro.user?.email && <span>{miembro.user.email}</span>}
                            {miembro.user?.email && <span> • </span>}
                            <span>Aceptado: {formatFecha(miembro.aceptado_en)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          miembro.rol === 'owner' ? 'bg-purple-100 text-purple-800' : 
                          miembro.rol === 'cajero' ? 'bg-blue-100 text-blue-800' : 
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {miembro.rol === 'owner' ? '👑 Owner' : miembro.rol === 'cajero' ? '👨💼 Cajero' : '👷 Empleado'}
                        </span>
                        {miembro.rol !== 'owner' && (
                          <button
                            onClick={async () => {
                              if (!confirm(`¿Quitar a ${miembro.user?.displayName} del local?`)) return
                              const { error } = await supabase.from('miembros_locales').update({ activo: false }).eq('id', miembro.id)
                              if (error) { toast.error('Error: ' + error.message); return }
                              toast.success('Miembro quitado')
                              loadData()
                            }}
                            className="px-3 py-1 bg-red-100 text-red-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-red-200"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="m-0 text-lg font-bold text-gray-900"> Auditoría de Operaciones</h2>
                  <p className="m-0 text-xs text-gray-500 mt-1">Registro detallado de todas las operaciones</p>
                </div>
                <button onClick={exportarCSV} className="px-4 py-2 bg-green-600 text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-green-700">📥 Exportar CSV</button>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="m-0 text-sm font-bold text-gray-700">🔍 Filtros</h3>
                  <button onClick={limpiarFiltros} className="px-3 py-1 bg-gray-200 text-gray-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-300">Limpiar</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                    <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                      <option value="todos">Todos</option>
                      <option value="Venta">Ventas</option>
                      <option value="Gasto">Gastos</option>
                      <option value="Apertura">Aperturas</option>
                      <option value="Cierre">Cierres</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Desde</label>
                    <input type="date" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Hasta</label>
                    <input type="date" value={filtroFechaHasta} onChange={(e) => setFiltroFechaHasta(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Usuario</label>
                    <input type="text" value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)} placeholder="Buscar por email..." className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-600">Mostrando <strong>{logsFiltrados.length}</strong> de <strong>{logs.length}</strong> operaciones</div>
              </div>

              {logsFiltrados.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-5xl mb-3">📭</div>
                  <h3 className="m-0 mb-2 text-gray-900 text-base font-bold">Sin operaciones registradas</h3>
                  <p className="m-0 text-gray-500 text-sm">Ajustá los filtros o registrá operaciones</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleOrdenamiento('creado_en')}>Fecha/Hora {ordenColumna === 'creado_en' ? (ordenDireccion === 'asc' ? '↑' : '↓') : ''}</th>
                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleOrdenamiento('tipo')}>Tipo {ordenColumna === 'tipo' ? (ordenDireccion === 'asc' ? '↑' : '↓') : ''}</th>
                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleOrdenamiento('usuario')}>Usuario {ordenColumna === 'usuario' ? (ordenDireccion === 'asc' ? '↑' : '↓') : ''}</th>
                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleOrdenamiento('concepto')}>Concepto {ordenColumna === 'concepto' ? (ordenDireccion === 'asc' ? '↑' : '↓') : ''}</th>
                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleOrdenamiento('medio_pago')}>Medio de Pago {ordenColumna === 'medio_pago' ? (ordenDireccion === 'asc' ? '↑' : '↓') : ''}</th>
                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleOrdenamiento('monto')}>Monto {ordenColumna === 'monto' ? (ordenDireccion === 'asc' ? '↑' : '↓') : ''}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsFiltrados.map((log, index) => {
                        const tipo = getTipoOperacion(log)
                        const esVenta = log.accion === 'VENTA_REGISTRADA'
                        const esGasto = log.accion === 'GASTO_REGISTRADO'
                        return (
                          <tr key={log.id} className={`bg-white border-b hover:bg-gray-50 ${index % 2 === 0 ? '' : 'bg-gray-50'}`}>
                            <td className="px-4 py-3 text-xs text-gray-900">{new Date(log.creado_en).toLocaleString('es-AR')}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${esVenta ? 'bg-green-100 text-green-800' : esGasto ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{tipo}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">{log.user_email || 'Sistema'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{log.detalles?.descripcion || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{log.detalles?.medio_pago || '-'}</td>
                            <td className="px-4 py-3 text-sm text-right font-semibold">
                              {log.detalles?.monto ? <span className={esGasto ? 'text-red-600' : 'text-green-600'}>{esGasto ? '-' : '+'}{formatCurrency(log.detalles.monto)}</span> : '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
        <div className="text-5xl mb-3">🚫</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Acceso Restringido</h1>
        <p className="text-sm text-gray-600 mb-4">No tenés permisos para ver este panel.</p>
        <button onClick={() => router.push('/dashboard')} className="px-6 py-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">Volver a Caja</button>
      </div>
    </div>
  )
}
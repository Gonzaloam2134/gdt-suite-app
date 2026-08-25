import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useUserRole } from '../lib/UserRoleContext'
import { formatCurrency } from '../lib/format'
import toast from 'react-hot-toast'

export default function AdminPanel() {
  const { role, globalRole, userId, loading: roleLoading } = useUserRole()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState(router.query.tab || 'resumen')
  const [loading, setLoading] = useState(true)

  // NUEVO: Filtros de fecha para el Resumen
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split('T')[0])
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])
  const [rangoActivo, setRangoActivo] = useState('hoy')

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

  // Estados para medios de pago
  const [mediosPago, setMediosPago] = useState([])

  // Efecto para actualizar la pestaña si la URL cambia
  useEffect(() => {
    if (router.query.tab) {
      setActiveTab(router.query.tab)
    }
  }, [router.query.tab])

  useEffect(() => {
    if (roleLoading) return

    if (!userId) {
      router.push('/')
      return
    }

    const rolEfectivo = role || globalRole

    if (rolEfectivo === 'empleado') {
      setActiveTab('mis-acciones')
    }

    // Cargar datos del día actual por defecto
    loadData(rolEfectivo)
  }, [roleLoading, role, globalRole, userId])

  const loadData = async (rolEfectivo = role || globalRole, desde = null, hasta = null) => {
    try {
      setLoading(true)
      const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

      console.log('🔍 [Admin] Iniciando carga - rolEfectivo:', rolEfectivo, 'globalRole:', globalRole, 'localId:', activeLocalId)

      // ==========================================
      // SUPER USER
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
      // OWNER
      // ==========================================
      if (rolEfectivo === 'owner') {
        if (!activeLocalId) {
          console.warn('⚠️ No hay local activo seleccionado')
          toast.error('Seleccioná un local primero desde "Mis Locales"')
          setLoading(false)
          return
        }

        const { data: localData } = await supabase
          .from('locales')
          .select('*')
          .eq('id', activeLocalId)
          .maybeSingle()
        setLocalInfo(localData)

        // Calcular rango de fechas
        let inicioRango, finRango
        
        if (desde && hasta) {
          inicioRango = new Date(desde + 'T00:00:00').toISOString()
          finRango = new Date(hasta + 'T23:59:59').toISOString()
        } else {
          // Por defecto: hoy
          const hoy = new Date().toISOString().split('T')[0]
          inicioRango = new Date(hoy + 'T00:00:00').toISOString()
          finRango = new Date(hoy + 'T23:59:59').toISOString()
        }

        // Estadísticas del local (con filtro de fecha)
        const { data: ventasData } = await supabase
          .from('transacciones')
          .select('monto')
          .eq('local_id', activeLocalId)
          .eq('tipo', 'COBRO_RECIBIDO')
          .gte('creado_en', inicioRango)
          .lte('creado_en', finRango)
        const totalVentas = ventasData?.reduce((sum, v) => sum + (v.monto || 0), 0) || 0

        const { data: gastosData } = await supabase
          .from('transacciones')
          .select('monto')
          .eq('local_id', activeLocalId)
          .eq('tipo', 'GASTO_REGISTRADO')
          .gte('creado_en', inicioRango)
          .lte('creado_en', finRango)
        const totalGastos = gastosData?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0

        const { count: countTx } = await supabase
          .from('transacciones')
          .select('*', { count: 'exact', head: true })
          .eq('local_id', activeLocalId)
          .gte('creado_en', inicioRango)
          .lte('creado_en', finRango)

        setLocalStats({
          ventas: totalVentas,
          gastos: totalGastos,
          transacciones: countTx || 0
        })

        // Cargar miembros
        const { data: miembrosData } = await supabase
          .from('miembros_locales')
          .select('*')
          .eq('local_id', activeLocalId)
          .eq('activo', true)

        const userIds = miembrosData?.map(m => m.user_id) || []
        let miembrosConPerfiles = []

        if (userIds.length > 0) {
          const { data: perfilesData } = await supabase
            .from('perfiles')
            .select('id, email, nombre, rol_global')
            .in('id', userIds)

          miembrosConPerfiles = (miembrosData || []).map(miembro => {
            const perfil = perfilesData?.find(p => p.id === miembro.user_id)
            return {
              ...miembro,
              user: perfil,
              perfiles: perfil
            }
          })
        }

        setMiembros(miembrosConPerfiles)

        // Cargar logs de auditoría (con filtro de fecha)
        const { data: logsData } = await supabase
          .from('logs_auditoria')
          .select('*')
          .eq('local_id', activeLocalId)
          .gte('creado_en', inicioRango)
          .lte('creado_en', finRango)
          .order('creado_en', { ascending: false })
          .limit(50)
        setLogs(logsData || [])

        // Cargar medios de pago
        await cargarMediosPago(activeLocalId)
      }

      // ==========================================
      // CAJERO
      // ==========================================
      if (rolEfectivo === 'cajero') {
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
  // FUNCIONES DE RANGO DE FECHAS
  // ==========================================
  const aplicarRangoFecha = (tipo) => {
    const hoy = new Date()
    let desde = new Date()
    let hasta = new Date()
    
    switch(tipo) {
      case 'hoy':
        // Ya está en hoy
        break
      case 'semana':
        desde.setDate(hoy.getDate() - 6)
        break
      case 'mes':
        desde.setDate(1) // Primer día del mes
        break
      case 'personalizado':
        // Usar los valores de los inputs
        break
      default:
        break
    }
    
    setFechaDesde(desde.toISOString().split('T')[0])
    setFechaHasta(hasta.toISOString().split('T')[0])
    setRangoActivo(tipo)
    
    const rolEfectivo = role || globalRole
    loadData(rolEfectivo, desde.toISOString().split('T')[0], hasta.toISOString().split('T')[0])
  }

  const aplicarFechasPersonalizadas = () => {
    setRangoActivo('personalizado')
    const rolEfectivo = role || globalRole
    loadData(rolEfectivo, fechaDesde, fechaHasta)
  }

  // ==========================================
  // FUNCIONES DE MEDIOS DE PAGO
  // ==========================================
  const cargarMediosPago = async (activeLocalId) => {
    if (!activeLocalId) return

    const { data } = await supabase
      .from('medios_pago')
      .select('*')
      .eq('local_id', activeLocalId)
      .order('orden', { ascending: true })

    setMediosPago(data || [])
  }

  const handleAgregarMedioPago = async () => {
    const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null
    const nombre = document.getElementById('mp-nombre')?.value
    const tipo = document.getElementById('mp-tipo')?.value
    const comision = parseFloat(document.getElementById('mp-comision')?.value) || 0
    const plazo = parseInt(document.getElementById('mp-plazo')?.value) || 0

    if (!nombre) {
      toast.error('Ingresá un nombre para el medio de pago')
      return
    }

    const iconos = {
      efectivo: '💵',
      credito: '💳',
      debito: '💳',
      transferencia: '',
      billetera_virtual: '📱'
    }

    try {
      const { error } = await supabase.from('medios_pago').insert([{
        local_id: activeLocalId,
        nombre,
        tipo,
        comision_porcentaje: comision,
        plazo_acreditacion_dias: plazo,
        icono: iconos[tipo] || '💳',
        habilitado: true,
        creado_por: userId
      }])

      if (error) throw error

      await supabase.from('logs_auditoria').insert([{
        local_id: activeLocalId,
        user_id: userId,
        accion: 'MEDIO_PAGO_CREADO',
        detalles: { nombre, tipo, comision, plazo }
      }])

      toast.success('✅ Medio de pago agregado')
      document.getElementById('mp-nombre').value = ''
      document.getElementById('mp-comision').value = ''
      document.getElementById('mp-plazo').value = ''
      await cargarMediosPago(activeLocalId)
    } catch (err) {
      toast.error('Error al agregar: ' + err.message)
    }
  }

  const handleToggleMedioPago = async (medioId, estadoActual) => {
    const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

    try {
      const { error } = await supabase
        .from('medios_pago')
        .update({ habilitado: !estadoActual })
        .eq('id', medioId)

      if (error) throw error

      toast.success(estadoActual ? 'Medio desactivado' : 'Medio activado')
      await cargarMediosPago(activeLocalId)
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleEliminarMedioPago = async (medioId) => {
    if (!confirm('¿Eliminar este medio de pago?')) return

    const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

    try {
      const { error } = await supabase
        .from('medios_pago')
        .delete()
        .eq('id', medioId)

      if (error) throw error

      toast.success('Medio de pago eliminado')
      await cargarMediosPago(activeLocalId)
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  // ==========================================
  // FUNCIONES DE MIEMBROS
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

      await supabase.from('logs_auditoria').insert([{
        local_id: activeLocalId,
        user_id: userId,
        accion: 'USUARIO_INVITADO',
        detalles: { email, nombre, rol }
      }])

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
    const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

    try {
      const { error: miembrosError } = await supabase
        .from('miembros_locales')
        .update({ rol: nuevoRol })
        .eq('id', miembroId)

      if (miembrosError) throw miembrosError

      const { error: perfilError } = await supabase
        .from('perfiles')
        .update({
          nombre: nuevoNombre,
          email: nuevoEmail,
          rol_global: nuevoRol
        })
        .eq('id', userIdPerfil)

      if (perfilError) throw perfilError

      await supabase.from('logs_auditoria').insert([{
        local_id: activeLocalId,
        user_id: userId,
        accion: 'ROL_CAMBIADO',
        detalles: { miembro_id: miembroId, nuevo_rol: nuevoRol, nombre: nuevoNombre }
      }])

      toast.success('✅ Miembro actualizado correctamente')
      setShowEditModal(false)
      setEditingMember(null)
      await loadData()

    } catch (err) {
      console.error('❌ Error al actualizar miembro:', err)
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
      'COBRO_REGISTRADO': { icono: '💰', texto: 'Cobro Registrado', color: 'bg-green-100 text-green-800' },
      'GASTO_REGISTRADO': { icono: '💸', texto: 'Gasto Registrado', color: 'bg-red-100 text-red-800' },
      'USUARIO_INVITADO': { icono: '', texto: 'Usuario Invitado', color: 'bg-purple-100 text-purple-800' },
      'INVITACION_ACEPTADA': { icono: '✅', texto: 'Invitación Aceptada', color: 'bg-emerald-100 text-emerald-800' },
      'MEDIO_PAGO_CREADO': { icono: '💳', texto: 'Medio de Pago Creado', color: 'bg-amber-100 text-amber-800' },
      'ROL_CAMBIADO': { icono: '🔄', texto: 'Rol Cambiado', color: 'bg-indigo-100 text-indigo-800' }
    }
    return labels[accion] || { icono: '', texto: accion, color: 'bg-gray-100 text-gray-800' }
  }

  const rolEfectivo = role || globalRole

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
                {tab === 'resumen' ? ' Resumen Global' : `🏪 Locales (${allLocales.length})`}
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
  if (rolEfectivo === 'owner') {
    return (
      <main className="min-h-screen bg-slate-100 pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/locales')}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200 flex items-center gap-1"
              >
                ← Volver
              </button>
              <div>
                <h1 className="m-0 text-lg font-bold text-gray-900">👑 Panel de Administración</h1>
                <p className="mt-0.5 text-xs text-gray-500">{localInfo?.nombre || 'Cargando local...'}</p>
              </div>
            </div>
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer hover:bg-gray-200">Salir</button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-4">
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            {[
              { id: 'resumen', label: '📊 Resumen' },
              { id: 'miembros', label: ' Miembros' },
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
              {/* Selector de rango de fechas */}
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 mb-3"> Período a consultar</h3>
                
                <div className="flex gap-2 mb-3 flex-wrap">
                  <button
                    onClick={() => aplicarRangoFecha('hoy')}
                    className={`px-3 py-1.5 border-none rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      rangoActivo === 'hoy' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    onClick={() => aplicarRangoFecha('semana')}
                    className={`px-3 py-1.5 border-none rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      rangoActivo === 'semana' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Últimos 7 días
                  </button>
                  <button
                    onClick={() => aplicarRangoFecha('mes')}
                    className={`px-3 py-1.5 border-none rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      rangoActivo === 'mes' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Este mes
                  </button>
                  <button
                    onClick={() => aplicarRangoFecha('personalizado')}
                    className={`px-3 py-1.5 border-none rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      rangoActivo === 'personalizado' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Personalizado
                  </button>
                </div>

                {rangoActivo === 'personalizado' && (
                  <div className="flex gap-3 items-end flex-wrap">
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-xs text-gray-600 mb-1">Desde:</label>
                      <input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-xs text-gray-600 mb-1">Hasta:</label>
                      <input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <button
                      onClick={aplicarFechasPersonalizadas}
                      className="px-4 py-2 bg-blue-500 text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-600"
                    >
                      🔄 Aplicar
                    </button>
                  </div>
                )}

                <div className="mt-3 text-xs text-gray-500">
                  📊 Mostrando datos del <strong>{new Date(fechaDesde + 'T12:00:00').toLocaleDateString('es-AR')}</strong> al <strong>{new Date(fechaHasta + 'T12:00:00').toLocaleDateString('es-AR')}</strong>
                </div>
              </div>

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
                <h2 className="m-0 mb-3 text-base font-bold text-gray-900">Últimas Acciones de Auditoría</h2>
                {logs.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin acciones registradas en este período.</p>
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
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <h3 className="text-base font-bold text-gray-900 mb-3">Agregar miembro al local</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" placeholder="Nombre *" className="p-2 border border-gray-300 rounded-lg text-sm" id="miembro-nombre" />
                  <input type="email" placeholder="Email *" className="p-2 border border-gray-300 rounded-lg text-sm" id="miembro-email" />
                  <select className="p-2 border border-gray-300 rounded-lg text-sm" id="miembro-rol">
                    <option value="cajero">‍💼 Cajero</option>
                    <option value="empleado">👷 Empleado</option>
                  </select>
                </div>
                <button onClick={handleAgregarMiembro} className="mt-3 w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">
                  + Enviar Invitación
                </button>
              </div>

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
                            {miembro.rol === 'owner' ? '👑' : miembro.rol === 'cajero' ? '👨‍💼' : ''}
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

              {showEditModal && editingMember && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">✏️ Editar Miembro</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre:</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Nombre completo"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email:</label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="email@ejemplo.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Rol:</label>
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="cajero">‍💼 Cajero - Opera caja y registra ventas</option>
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
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <h3 className="text-base font-bold text-gray-900 mb-4">💳 Gestión de Medios de Pago</h3>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-3">Agregar nuevo medio de pago</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Nombre (ej: Mercado Pago)"
                      className="p-2 border border-gray-300 rounded-lg text-sm"
                      id="mp-nombre"
                    />
                    <select className="p-2 border border-gray-300 rounded-lg text-sm" id="mp-tipo">
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="credito">💳 Tarjeta de Crédito</option>
                      <option value="debito">💳 Tarjeta de Débito</option>
                      <option value="transferencia">🏦 Transferencia</option>
                      <option value="billetera_virtual"> Billetera Virtual</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Comisión % (ej: 3.5)"
                      className="p-2 border border-gray-300 rounded-lg text-sm"
                      id="mp-comision"
                    />
                    <input
                      type="number"
                      placeholder="Plazo acreditación (días)"
                      className="p-2 border border-gray-300 rounded-lg text-sm"
                      id="mp-plazo"
                    />
                  </div>
                  <button
                    onClick={handleAgregarMedioPago}
                    className="mt-3 w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600"
                  >
                    + Agregar Medio de Pago
                  </button>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3">Medios de pago configurados ({mediosPago.length})</h4>
                  {mediosPago.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay medios de pago configurados.</p>
                  ) : (
                    <div className="space-y-2">
                      {mediosPago.map(medio => (
                        <div key={medio.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{medio.icono || '💳'}</div>
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">{medio.nombre}</div>
                              <div className="text-xs text-gray-500">
                                {medio.tipo} • Comisión: {medio.comision_porcentaje}% • Acreditación: {medio.plazo_acreditacion_dias} días
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              medio.habilitado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {medio.habilitado ? 'Activo' : 'Inactivo'}
                            </span>
                            <button
                              onClick={() => handleToggleMedioPago(medio.id, medio.habilitado)}
                              className="px-3 py-1 bg-amber-100 text-amber-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-amber-200"
                            >
                              {medio.habilitado ? 'Desactivar' : 'Activar'}
                            </button>
                            <button
                              onClick={() => handleEliminarMedioPago(medio.id)}
                              className="px-3 py-1 bg-red-100 text-red-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-red-200"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <h2 className="m-0 mb-3 text-base font-bold text-gray-900">📋 Logs de Auditoría</h2>
              {logs.length === 0 ? (
                <p className="text-sm text-gray-500">Sin logs registrados en este período.</p>
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
  if (rolEfectivo === 'cajero') {
    return (
      <main className="min-h-screen bg-slate-100 pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/locales')}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200 flex items-center gap-1"
              >
                ← Volver
              </button>
              <div>
                <h1 className="m-0 text-lg font-bold text-gray-900">👨‍💼 Panel de Cajero</h1>
                <p className="mt-0.5 text-xs text-gray-500">{localInfo?.nombre || 'Mi Local'}</p>
              </div>
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
  if (rolEfectivo === 'empleado') {
    return (
      <main className="min-h-screen bg-slate-100 pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/locales')}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200 flex items-center gap-1"
              >
                ← Volver
              </button>
              <div>
                <h1 className="m-0 text-lg font-bold text-gray-900">👷 Mis Acciones</h1>
                <p className="mt-0.5 text-xs text-gray-500">Registro de tu actividad</p>
              </div>
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
  // RENDER: Acceso Restringido
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl border border-gray-200 text-center max-w-md">
        <div className="text-5xl mb-3"></div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Acceso Restringido</h1>
        <p className="text-sm text-gray-600 mb-2">No tenés permisos para ver este panel.</p>
        <button onClick={() => router.push('/locales')} className="px-6 py-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">
          Volver a Mis Locales
        </button>
      </div>
    </div>
  )
}
import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useUserRole } from '../lib/useUserRole'
import { formatCurrency } from '../lib/format'
import toast from 'react-hot-toast'

// ✅ ICONOS AUTOMÁTICOS POR TIPO
const ICONOS_POR_TIPO = {
  efectivo: '💵',
  debito: '💳',
  credito: '💳',
  transferencia: '🏦',
  qr: '📱',
  cheque: '',
  otro: '📦'
}

// ✅ OPERADORES DE TARJETAS
const OPERADORES_TARJETA = [
  'Visa', 'Mastercard', 'American Express', 'Cabal', 'Naranja', 
  'Nevada', 'Argencard', 'Diners Club', 'Tarjeta Shopping'
]

// ✅ BANCOS ARGENTINA
const BANCOS_ARGENTINA = [
  'Galicia', 'Santander Río', 'BBVA', 'Macro', 'Nación', 'ICBC',
  'Brubank', 'Supervielle', 'HSBC', 'Citibank', 'Patagonia',
  'Provincia', 'Ciudad', 'Comafi', 'Hipotecario', 'Itaú',
  'BMA', 'Credicoop', 'Industrial', 'BICA', 'Banco del Sol',
  'Banco Ciudad', 'Banco Santa Fe', 'Banco de Corrientes'
]

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
  const [mediosPago, setMediosPago] = useState([])

  // Estados para edición de miembros
  const [editingMember, setEditingMember] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [newRole, setNewRole] = useState('')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')

  // ✅ NUEVO: Estados para gestión de medios de pago
  const [showMedioModal, setShowMedioModal] = useState(false)
  const [editingMedio, setEditingMedio] = useState(null)
  const [medioForm, setMedioForm] = useState({
    nombre: '',
    tipo: 'efectivo',
    operador: '',
    banco_emisor: '',
    comision_porcentaje: '0',
    plazo_acreditacion_dias: '0',
    habilitado: true
  })

  // ✅ Estados para agregar "Otro" operador/banco
  const [showNewOperador, setShowNewOperador] = useState(false)
  const [newOperadorName, setNewOperadorName] = useState('')
  const [showNewBanco, setShowNewBanco] = useState(false)
  const [newBancoName, setNewBancoName] = useState('')
  const [operadoresCustom, setOperadoresCustom] = useState([])
  const [bancosCustom, setBancosCustom] = useState([])
  
  const router = useRouter()

  useEffect(() => {
    if (roleLoading) return
    if (!userId) { router.push('/'); return }
    if (role === 'empleado') { setActiveTab('mis-acciones') }
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
        const { data: localesData } = await supabase.from('locales').select('id, nombre, rubro, creado_en').order('creado_en', { ascending: false })
        setAllLocales(localesData || [])
        setActiveTab('resumen')
      }
      
      if (role === 'owner' || role === 'cajero') {
        if (!activeLocalId) {
          toast.error('Seleccioná un local primero'); setLoading(false); return
        }

        const { data: localData } = await supabase.from('locales').select('*').eq('id', activeLocalId).maybeSingle()
        setLocalInfo(localData)

        const { data: ventasData } = await supabase.from('transacciones').select('monto').eq('local_id', activeLocalId).eq('tipo', 'COBRO_RECIBIDO')
        const totalVentas = ventasData?.reduce((sum, v) => sum + (v.monto || 0), 0) || 0

        const { data: gastosData } = await supabase.from('transacciones').select('monto').eq('local_id', activeLocalId).eq('tipo', 'GASTO_REGISTRADO')
        const totalGastos = gastosData?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0

        const { count: countTx } = await supabase.from('transacciones').select('*', { count: 'exact', head: true }).eq('local_id', activeLocalId)
        setLocalStats({ ventas: totalVentas, gastos: totalGastos, transacciones: countTx || 0 })

        const { data: miembrosData } = await supabase.from('miembros_locales').select(`id, rol, activo, aceptado_en, user_id, perfiles (id, email, nombre)`).eq('local_id', activeLocalId).eq('activo', true)
        setMiembros((miembrosData || []).map(m => ({ ...m, user: m.perfiles })))

        const { data: mediosData } = await supabase.from('medios_pago').select('*').eq('local_id', activeLocalId).order('orden', { ascending: true })
        setMediosPago(mediosData || [])

        const { data: logsData } = await supabase.from('logs_auditoria').select('*').eq('local_id', activeLocalId).order('creado_en', { ascending: false }).limit(50)
        setLogs(logsData || [])

        if (role === 'cajero') {
          const { data: misLogs } = await supabase.from('logs_auditoria').select('*').eq('local_id', activeLocalId).eq('user_id', userId).order('creado_en', { ascending: false }).limit(30)
          setMisAcciones(misLogs || [])
        }
      }
    } catch (err) {
      console.error('Error cargando admin:', err)
      toast.error('Error al cargar el panel')
    } finally {
      setLoading(false)
    }
  }

  // --- Funciones de Miembros ---
  const handleEditRole = async (miembroId, userIdPerfil, nuevoRol, nuevoNombre, nuevoEmail) => {
    try {
      await supabase.from('miembros_locales').update({ rol: nuevoRol }).eq('id', miembroId)
      await supabase.from('perfiles').update({ nombre: nuevoNombre, email: nuevoEmail, rol_global: nuevoRol }).eq('id', userIdPerfil)
      toast.success('✅ Miembro actualizado')
      setShowEditModal(false); setEditingMember(null)
      await loadData()
    } catch (err) { toast.error('Error: ' + err.message) }
  }

  const handleQuitarMiembro = async (miembroId) => {
    if (!confirm('¿Quitar este miembro del local?')) return
    try {
      await supabase.from('miembros_locales').update({ activo: false }).eq('id', miembroId)
      toast.success('Miembro quitado'); await loadData()
    } catch (err) { toast.error('Error: ' + err.message) }
  }

  // ✅ NUEVO: Funciones de Medios de Pago
  const openMedioModal = (medio = null) => {
    if (medio) {
      setEditingMedio(medio)
      setMedioForm({
        nombre: medio.nombre || '',
        tipo: medio.tipo || 'efectivo',
        operador: medio.operador || '',
        banco_emisor: medio.banco_emisor || '',
        comision_porcentaje: String(medio.comision_porcentaje || 0),
        plazo_acreditacion_dias: String(medio.plazo_acreditacion_dias || 0),
        habilitado: medio.habilitado !== false
      })
    } else {
      setEditingMedio(null)
      setMedioForm({
        nombre: '',
        tipo: 'efectivo',
        operador: '',
        banco_emisor: '',
        comision_porcentaje: '0',
        plazo_acreditacion_dias: '0',
        habilitado: true
      })
    }
    setShowNewOperador(false)
    setShowNewBanco(false)
    setNewOperadorName('')
    setNewBancoName('')
    setShowMedioModal(true)
  }

  const handleSaveMedio = async () => {
    try {
      const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null
      if (!activeLocalId) {
        toast.error('No hay local activo')
        return
      }
      if (!medioForm.nombre.trim()) {
        toast.error('Ingresá un nombre para el medio de pago')
        return
      }

      // ✅ Generar nombre automático si no se ingresó
      let nombreFinal = medioForm.nombre.trim()
      if (!medioForm.nombre.trim() && medioForm.operador) {
        nombreFinal = `${medioForm.operador} ${medioForm.tipo === 'credito' ? 'Crédito' : 'Débito'}`
      }

      const payload = {
        local_id: activeLocalId,
        nombre: nombreFinal,
        tipo: medioForm.tipo,
        icono: ICONOS_POR_TIPO[medioForm.tipo] || '💳',
        operador: medioForm.operador || null,
        banco_emisor: medioForm.banco_emisor || null,
        comision_porcentaje: parseFloat(medioForm.comision_porcentaje) || 0,
        plazo_acreditacion_dias: parseInt(medioForm.plazo_acreditacion_dias) || 0,
        habilitado: medioForm.habilitado,
        activo: medioForm.habilitado,
        es_default: false,
        orden: mediosPago.length,
        creado_por: userId,
        actualizado_en: new Date().toISOString()
      }

      if (editingMedio) {
        const { error } = await supabase.from('medios_pago').update(payload).eq('id', editingMedio.id)
        if (error) throw error
        toast.success('✅ Medio de pago actualizado')
      } else {
        const { error } = await supabase.from('medios_pago').insert([payload])
        if (error) throw error
        toast.success('✅ Medio de pago creado')
      }

      setShowMedioModal(false)
      setEditingMedio(null)
      await loadData()
    } catch (err) {
      console.error('Error guardando medio:', err)
      toast.error('Error: ' + err.message)
    }
  }

  const handleDeleteMedio = async (medioId, medioNombre) => {
    if (!confirm(`¿Eliminar "${medioNombre}"? Esta acción no se puede deshacer.`)) return
    try {
      const { error } = await supabase.from('medios_pago').delete().eq('id', medioId)
      if (error) throw error
      toast.success('Medio de pago eliminado')
      await loadData()
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    }
  }

  const handleToggleMedioPago = async (medioId, estadoActual) => {
    try {
      const nuevoEstado = !estadoActual
      const { error } = await supabase.from('medios_pago').update({ 
        habilitado: nuevoEstado,
        activo: nuevoEstado,
        actualizado_en: new Date().toISOString()
      }).eq('id', medioId)
      if (error) throw error
      toast.success(nuevoEstado ? 'Medio activado' : 'Medio desactivado')
      await loadData()
    } catch (err) { toast.error('Error al actualizar: ' + err.message) }
  }

  // ✅ Agregar nuevo operador
  const handleAddOperador = () => {
    if (!newOperadorName.trim()) {
      toast.error('Ingresá un nombre para el operador')
      return
    }
    setOperadoresCustom([...operadoresCustom, newOperadorName.trim()])
    setMedioForm({...medioForm, operador: newOperadorName.trim()})
    setNewOperadorName('')
    setShowNewOperador(false)
    toast.success(`Operador "${newOperadorName.trim()}" agregado`)
  }

  // ✅ Agregar nuevo banco
  const handleAddBanco = () => {
    if (!newBancoName.trim()) {
      toast.error('Ingresá un nombre para el banco')
      return
    }
    setBancosCustom([...bancosCustom, newBancoName.trim()])
    setMedioForm({...medioForm, banco_emisor: newBancoName.trim()})
    setNewBancoName('')
    setShowNewBanco(false)
    toast.success(`Banco "${newBancoName.trim()}" agregado`)
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/') }
  const formatFecha = (fecha) => fecha ? new Date(fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'

  const getAccionLabel = (accion) => {
    const labels = {
      'CAJA_ABIERTA': { icono: '🔓', texto: 'Caja Abierta', color: 'bg-blue-100 text-blue-800' },
      'CAJA_CERRADA': { icono: '', texto: 'Caja Cerrada', color: 'bg-gray-100 text-gray-800' },
      'VENTA_REGISTRADA': { icono: '💰', texto: 'Venta', color: 'bg-green-100 text-green-800' },
      'GASTO_REGISTRADO': { icono: '', texto: 'Gasto', color: 'bg-red-100 text-red-800' },
      'ROL_CAMBIADO': { icono: '🔄', texto: 'Rol Cambiado', color: 'bg-indigo-100 text-indigo-800' }
    }
    return labels[accion] || { icono: '', texto: accion, color: 'bg-gray-100 text-gray-800' }
  }

  if (roleLoading || loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p>Cargando panel...</p></div>

  if (role === 'owner') {
    return (
      <main className="min-h-screen bg-slate-100 pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="m-0 text-lg font-bold text-gray-900"> Panel de Administración</h1>
              <p className="mt-0.5 text-xs text-gray-500">{localInfo?.nombre || 'Cargando...'}</p>
            </div>
            <button onClick={handleSignOut} className="px-3 py-1.5 bg-gray-100 rounded-md text-gray-500 text-xs font-medium cursor-pointer hover:bg-gray-200">Salir</button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto p-4">
          <div className="flex gap-2 mb-4 border-b border-gray-200 overflow-x-auto">
            {[
              { id: 'resumen', label: ' Resumen' },
              { id: 'miembros', label: '👥 Miembros' },
              { id: 'medios-pago', label: '💳 Medios de Pago' },
              { id: 'logs', label: '⚙️ Administración' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-semibold cursor-pointer border-none rounded-t-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.id ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'resumen' && (
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
          )}

          {activeTab === 'miembros' && (
            <div className="space-y-2">
              {miembros.length === 0 ? <p className="text-sm text-gray-500">Sin miembros.</p> : miembros.map(miembro => (
                <div key={miembro.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${miembro.rol === 'owner' ? 'bg-purple-100' : miembro.rol === 'cajero' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      {miembro.rol === 'owner' ? '👑' : miembro.rol === 'cajero' ? '👨‍💼' : '👷'}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{miembro.perfiles?.nombre || miembro.user?.email || 'Usuario'}</div>
                      <div className="text-xs text-gray-500">{miembro.perfiles?.email || miembro.user?.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${miembro.rol === 'owner' ? 'bg-purple-100 text-purple-800' : miembro.rol === 'cajero' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                      {miembro.rol === 'owner' ? 'Owner' : miembro.rol === 'cajero' ? 'Cajero' : 'Empleado'}
                    </span>
                    {miembro.rol !== 'owner' && (
                      <>
                        <button onClick={() => { setEditingMember(miembro); setNewRole(miembro.rol); setEditName(miembro.perfiles?.nombre || ''); setEditEmail(miembro.perfiles?.email || ''); setShowEditModal(true) }} className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold cursor-pointer hover:bg-amber-200">✏️ Editar</button>
                        <button onClick={() => handleQuitarMiembro(miembro.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold cursor-pointer hover:bg-red-200">Quitar</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'medios-pago' && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 m-0">💡 Agregá, editá o desactivá los medios de pago. El icono se asigna automáticamente según el tipo.</p>
              </div>
              
              <button
                onClick={() => openMedioModal(null)}
                className="w-full p-4 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 mb-4 flex items-center justify-center gap-2"
              >
                <span className="text-xl">+</span> Agregar Medio de Pago
              </button>
              
              {mediosPago.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No hay medios de pago configurados aún.</p>
              ) : (
                mediosPago.map(medio => (
                  <div key={medio.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">{medio.icono || ICONOS_POR_TIPO[medio.tipo] || ''}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">{medio.nombre}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {medio.operador && <span className="mr-2">🏷️ {medio.operador}</span>}
                          {medio.banco_emisor && <span className="mr-2"> {medio.banco_emisor}</span>}
                          {medio.comision_porcentaje > 0 ? `${medio.comision_porcentaje}% comisión` : 'Sin comisión'} · {' '}
                          {medio.plazo_acreditacion_dias === 0 ? 'Acreditación inmediata' : `Se acredita en ${medio.plazo_acreditacion_dias} días`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleMedioPago(medio.id, medio.habilitado)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${medio.habilitado ? 'bg-green-500' : 'bg-gray-300'}`}
                        title={medio.habilitado ? 'Desactivar' : 'Activar'}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${medio.habilitado ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <button
                        onClick={() => openMedioModal(medio)}
                        className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded text-xs font-semibold cursor-pointer hover:bg-amber-200"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteMedio(medio.id, medio.nombre)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs font-semibold cursor-pointer hover:bg-red-200"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-2">
              {logs.length === 0 ? <p className="text-sm text-gray-500">Sin logs registrados.</p> : logs.map(log => {
                const accionInfo = getAccionLabel(log.accion)
                return (
                  <div key={log.id} className="p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${accionInfo.color}`}>{accionInfo.icono}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">{accionInfo.texto}</div>
                        <div className="text-xs text-gray-500 mt-1">{formatFecha(log.creado_en)}</div>
                        {log.detalles?.monto && <div className="text-xs text-gray-600 mt-1">💵 {formatCurrency(log.detalles.monto)}</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre:</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email:</label>
                  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rol:</label>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg text-sm">
                    <option value="cajero">👨‍ Cajero</option>
                    <option value="empleado">👷 Empleado</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => handleEditRole(editingMember.id, editingMember.user_id || editingMember.perfiles?.id, newRole, editName, editEmail)} className="flex-1 p-3 bg-blue-500 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">💾 Guardar</button>
                <button onClick={() => { setShowEditModal(false); setEditingMember(null) }} className="flex-1 p-3 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-300">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ Modal de Medio de Pago MEJORADO */}
        {showMedioModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {editingMedio ? '✏️ Editar Medio de Pago' : ' Nuevo Medio de Pago'}
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                {editingMedio ? 'Modificá los datos del medio de pago.' : 'Configurá un nuevo medio de pago para tu caja.'}
              </p>
              
              <div className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre *</label>
                  <input 
                    type="text" 
                    value={medioForm.nombre} 
                    onChange={(e) => setMedioForm({...medioForm, nombre: e.target.value})} 
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ej: Visa Crédito, Mercado Pago QR"
                  />
                </div>

                {/* Tipo (con icono automático) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(ICONOS_POR_TIPO).map(([tipo, icono]) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setMedioForm({...medioForm, tipo})}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          medioForm.tipo === tipo 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">{icono}</div>
                        <div className="text-xs font-medium text-gray-700 capitalize">{tipo}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Operador (solo para tarjetas) */}
                {(medioForm.tipo === 'debito' || medioForm.tipo === 'credito') && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Operador de tarjeta</label>
                    {!showNewOperador ? (
                      <select 
                        value={medioForm.operador} 
                        onChange={(e) => { 
                          if (e.target.value === 'OTRO') {
                            setShowNewOperador(true)
                          } else {
                            setMedioForm({...medioForm, operador: e.target.value})
                          }
                        }} 
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Seleccionar operador...</option>
                        {OPERADORES_TARJETA.map(op => (
                          <option key={op} value={op}>{op}</option>
                        ))}
                        {operadoresCustom.map(op => (
                          <option key={`custom-${op}`} value={op}>{op} (personalizado)</option>
                        ))}
                        <option value="OTRO">➕ Otro (agregar nuevo)</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newOperadorName} 
                          onChange={(e) => setNewOperadorName(e.target.value)} 
                          placeholder="Nombre del operador"
                          className="flex-1 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button 
                          type="button"
                          onClick={handleAddOperador} 
                          className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-emerald-600"
                        >
                          Guardar
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setShowNewOperador(false); setNewOperadorName('') }} 
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm cursor-pointer hover:bg-gray-300"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Banco (para transferencia y tarjetas) */}
                {(medioForm.tipo === 'transferencia' || medioForm.tipo === 'debito' || medioForm.tipo === 'credito') && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Banco emisor</label>
                    {!showNewBanco ? (
                      <select 
                        value={medioForm.banco_emisor} 
                        onChange={(e) => { 
                          if (e.target.value === 'OTRO') {
                            setShowNewBanco(true)
                          } else {
                            setMedioForm({...medioForm, banco_emisor: e.target.value})
                          }
                        }} 
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Seleccionar banco...</option>
                        {BANCOS_ARGENTINA.map(banco => (
                          <option key={banco} value={banco}>{banco}</option>
                        ))}
                        {bancosCustom.map(banco => (
                          <option key={`custom-${banco}`} value={banco}>{banco} (personalizado)</option>
                        ))}
                        <option value="OTRO">➕ Otro (agregar nuevo)</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newBancoName} 
                          onChange={(e) => setNewBancoName(e.target.value)} 
                          placeholder="Nombre del banco"
                          className="flex-1 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button 
                          type="button"
                          onClick={handleAddBanco} 
                          className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-emerald-600"
                        >
                          Guardar
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setShowNewBanco(false); setNewBancoName('') }} 
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm cursor-pointer hover:bg-gray-300"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Comisión y Plazo */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Comisión (%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      max="100" 
                      value={medioForm.comision_porcentaje} 
                      onChange={(e) => setMedioForm({...medioForm, comision_porcentaje: e.target.value})} 
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Plazo (días)</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="90" 
                      value={medioForm.plazo_acreditacion_dias} 
                      onChange={(e) => setMedioForm({...medioForm, plazo_acreditacion_dias: e.target.value})} 
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="0 = inmediato"
                    />
                  </div>
                </div>

                {/* Habilitado */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={medioForm.habilitado} 
                      onChange={(e) => setMedioForm({...medioForm, habilitado: e.target.checked})}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Medio habilitado</div>
                      <div className="text-xs text-gray-600">Si lo desactivás, no aparecerá en la Caja.</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={handleSaveMedio} 
                  className="flex-1 p-3 bg-blue-500 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600"
                >
                  💾 {editingMedio ? 'Guardar Cambios' : 'Crear Medio'}
                </button>
                <button 
                  onClick={() => { setShowMedioModal(false); setEditingMedio(null) }} 
                  className="flex-1 p-3 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    )
  }

  return <div className="p-8 text-center">Cargando o acceso restringido...</div>
}

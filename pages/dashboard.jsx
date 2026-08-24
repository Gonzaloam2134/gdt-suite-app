import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { formatCurrency } from '../lib/format'
import toast from 'react-hot-toast'
import ReversaModal from '../components/ReversaModal'
import ContactModal from '../components/ContactModal'
import CobroModal from '../components/CobroModal'
import GastoModal from '../components/GastoModal'

// ==========================================
// HOOK: Detectar mobile
// ==========================================
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  
  return isMobile
}

export default function Dashboard() {
  const isMobile = useIsMobile()
  const [user, setUser] = useState(null)
  const [local, setLocal] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [transacciones, setTransacciones] = useState([])
  
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date().toISOString().split('T')[0])
  const [esHoy, setEsHoy] = useState(true)
  
  const [totales, setTotales] = useState({
    cobrosHoy: 0,
    gastosHoy: 0,
    efectivoEnCaja: 0,
    disponibleHoy: 0,
    pendienteAcreditacion: 0,
    totalComisiones: 0,
    netoReal: 0
  })
  
  const [acreditacionesHoy, setAcreditacionesHoy] = useState([])
  const [desgloseMedios, setDesgloseMedios] = useState([])
  
  const [seccionesColapsadas, setSeccionesColapsadas] = useState({
    cobros: false,
    gastos: false,
    acreditaciones: false,
    desglose: false
  })
  
  const [paginas, setPaginas] = useState({
    cobros: 1,
    gastos: 1,
    acreditaciones: 1,
    desglose: 1
  })
  
  const ITEMS_POR_PAGINA = 15
  
  // Estados de modales
  const [showCobroModal, setShowCobroModal] = useState(false)
  const [showGastoModal, setShowGastoModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showReversaModal, setShowReversaModal] = useState(false)
  const [transaccionAReversar, setTransaccionAReversar] = useState(null)
  
  // Estados de caja
  const [cajaAbierta, setCajaAbierta] = useState(null)
  const [showAperturaModal, setShowAperturaModal] = useState(false)
  const [showCierreModal, setShowCierreModal] = useState(false)
  const [showHistorialModal, setShowHistorialModal] = useState(false)
  const [montoInicial, setMontoInicial] = useState('')
  const [efectivoFisico, setEfectivoFisico] = useState('')
  const [observacionesCierre, setObservacionesCierre] = useState('')
  const [historialCierres, setHistorialCierres] = useState([])
  const [loadingCaja, setLoadingCaja] = useState(false)
  
  // Estados para UI
  const [showMenu, setShowMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showMasMetricas, setShowMasMetricas] = useState(false)
  const [cardExpandida, setCardExpandida] = useState(null)
  const [cardInfoOpen, setCardInfoOpen] = useState(null)
  
  const router = useRouter()

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = () => {
      setShowMenu(false)
    }
    if (showMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showMenu])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
      
      const activeLocalId = localStorage.getItem('activeLocalId')
      if (!activeLocalId) { router.push('/locales'); return }
      
      const { data: localData } = await supabase.from('locales').select('*').eq('id', activeLocalId).single()
      setLocal(localData)
      
      await verificarCajaAbierta(activeLocalId)
      await cargarCaja(activeLocalId)
    })
  }, [router])

  // ==========================================
  // FUNCIONES DE CAJA
  // ==========================================
  const verificarCajaAbierta = async (localId) => {
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const inicioHoy = new Date(hoy + 'T00:00:00').toISOString()
      const finHoy = new Date(hoy + 'T23:59:59').toISOString()
      
      const { data, error } = await supabase
        .from('cierres_caja')
        .select('*')
        .eq('local_id', localId)
        .eq('estado', 'abierta')
        .gte('fecha_apertura', inicioHoy)
        .lte('fecha_apertura', finHoy)
        .maybeSingle()
      
      if (error) throw error
      setCajaAbierta(data)
    } catch (err) {
      console.error('Error verificando caja:', err)
    }
  }

  const handleAbrirCaja = async () => {
    if (!montoInicial || parseFloat(montoInicial) < 0) {
      toast.error('Ingresá un monto inicial válido')
      return
    }

    try {
      setLoadingCaja(true)
      
      const { data, error } = await supabase
        .from('cierres_caja')
        .insert([{
          local_id: local.id,
          user_id: user.id,
          monto_inicial_efectivo: parseFloat(montoInicial),
          estado: 'abierta',
          fecha_apertura: new Date().toISOString()
        }])
        .select()
        .single()
      
      if (error) throw error
      
      await supabase.from('logs_auditoria').insert([{
        local_id: local.id,
        user_id: user.id,
        accion: 'CAJA_ABIERTA',
        detalles: { monto_inicial: parseFloat(montoInicial) }
      }])
      
      setCajaAbierta(data)
      setShowAperturaModal(false)
      setMontoInicial('')
      toast.success('✅ Caja abierta correctamente')
      
      await cargarCaja(local.id, fechaSeleccionada)
    } catch (err) {
      console.error('Error abriendo caja:', err)
      toast.error('Error al abrir caja: ' + err.message)
    } finally {
      setLoadingCaja(false)
    }
  }

  const handleCerrarCaja = async () => {
    if (!cajaAbierta) {
      toast.error('No hay caja abierta')
      return
    }

    const efectivoFisicoNum = efectivoFisico === '' ? null : parseFloat(efectivoFisico)
    const efectivoEsperado = cajaAbierta.monto_inicial_efectivo + totales.efectivoEnCaja
    
    let diferencia = null
    if (efectivoFisicoNum !== null) {
      diferencia = efectivoFisicoNum - efectivoEsperado
    }

    try {
      setLoadingCaja(true)
      
      const { error } = await supabase
        .from('cierres_caja')
        .update({
          estado: 'cerrada',
          fecha_cierre: new Date().toISOString(),
          total_cobrado: totales.cobrosHoy,
          total_gastado: totales.gastosHoy,
          cantidad_transacciones: transacciones.length,
          efectivo_fisico: efectivoFisicoNum,
          diferencia_efectivo: diferencia,
          observaciones: observacionesCierre || null
        })
        .eq('id', cajaAbierta.id)
      
      if (error) throw error
      
      await supabase.from('logs_auditoria').insert([{
        local_id: local.id,
        user_id: user.id,
        accion: 'CAJA_CERRADA',
        detalles: {
          total_cobrado: totales.cobrosHoy,
          total_gastado: totales.gastosHoy,
          efectivo_fisico: efectivoFisicoNum,
          diferencia: diferencia
        }
      }])
      
      setCajaAbierta(null)
      setShowCierreModal(false)
      setEfectivoFisico('')
      setObservacionesCierre('')
      toast.success('✅ Caja cerrada correctamente')
      
      await verificarCajaAbierta(local.id)
      await cargarCaja(local.id, fechaSeleccionada)
    } catch (err) {
      console.error('Error cerrando caja:', err)
      toast.error('Error al cerrar caja: ' + err.message)
    } finally {
      setLoadingCaja(false)
    }
  }

  const cargarHistorialCierres = async () => {
    try {
      const { data, error } = await supabase
        .from('cierres_caja')
        .select('*')
        .eq('local_id', local.id)
        .eq('estado', 'cerrada')
        .order('fecha_cierre', { ascending: false })
        .limit(50)
      
      if (error) throw error
      
      setHistorialCierres(data || [])
      setShowHistorialModal(true)
    } catch (err) {
      console.error('Error cargando historial:', err)
      toast.error('Error al cargar historial')
    }
  }

  // ==========================================
  // FUNCIONES DE TRANSACCIONES
  // ==========================================
  const cargarCaja = async (localId, fecha = null) => {
    try {
      setLoading(true)
      
      const fechaBase = fecha ? new Date(fecha + 'T12:00:00') : new Date()
      const inicioDia = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), fechaBase.getDate()).toISOString()
      const finDia = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), fechaBase.getDate(), 23, 59, 59).toISOString()
      
      const { data: transaccionesData } = await supabase
        .from('transacciones')
        .select(`
          *,
          medios_pago (nombre, tipo, icono, plazo_acreditacion_dias, comision_porcentaje)
        `)
        .eq('local_id', localId)
        .gte('creado_en', inicioDia)
        .lte('creado_en', finDia)
        .order('creado_en', { ascending: false })
      
      setTransacciones(transaccionesData || [])
      calcularTotales(transaccionesData || [], fechaBase)
      
    } catch (err) {
      console.error('Error cargando caja:', err)
      toast.error('Error al cargar datos de la caja')
    } finally {
      setLoading(false)
    }
  }

  const calcularTotales = (transacciones, fechaBase = new Date()) => {
    const diaSeleccionado = fechaBase.toISOString().split('T')[0]
    const ahora = new Date()
    const hoyStr = ahora.toISOString().split('T')[0]
    const esDiaHoy = diaSeleccionado === hoyStr
    
    setEsHoy(esDiaHoy)
    
    let cobrosDia = 0
    let gastosDia = 0
    let efectivoEnCaja = 0
    let disponibleDia = 0
    let pendienteAcreditacion = 0
    let totalComisiones = 0
    
    const mediosMap = {}
    const acreditacionesArray = []
    
    transacciones.forEach(t => {
      const fechaTx = new Date(t.creado_en).toISOString().split('T')[0]
      const medio = t.medios_pago || {}
      const plazoDias = medio.plazo_acreditacion_dias || 0
      const comision = (t.monto || 0) * (medio.comision_porcentaje || 0) / 100
      
      const fechaAcred = new Date(t.creado_en)
      fechaAcred.setDate(fechaAcred.getDate() + plazoDias)
      const fechaAcredStr = fechaAcred.toISOString().split('T')[0]
      
      if (t.tipo === 'COBRO_RECIBIDO' && !t.es_reversa) {
        if (fechaTx === diaSeleccionado) {
          cobrosDia += t.monto || 0
        }
        
        if (medio.tipo === 'efectivo') {
          efectivoEnCaja += t.monto || 0
        }
        
        if (fechaAcredStr === diaSeleccionado) {
          disponibleDia += (t.monto || 0) - comision
        } else {
          pendienteAcreditacion += (t.monto || 0) - comision
        }
        
        totalComisiones += comision
        
        if (fechaAcredStr === diaSeleccionado && medio.tipo !== 'efectivo') {
          acreditacionesArray.push({
            ...t,
            comision: comision,
            neto: (t.monto || 0) - comision
          })
        }
        
        const medioKey = medio.nombre || 'Sin medio'
        if (!mediosMap[medioKey]) {
          mediosMap[medioKey] = { 
            nombre: medioKey, 
            tipo: medio.tipo || 'otro', 
            total: 0, 
            cantidad: 0, 
            comisiones: 0 
          }
        }
        mediosMap[medioKey].total += t.monto || 0
        mediosMap[medioKey].cantidad++
        mediosMap[medioKey].comisiones += comision
        
      } else if (t.tipo === 'GASTO_REGISTRADO' && !t.es_reversa) {
        if (fechaTx === diaSeleccionado) {
          gastosDia += t.monto || 0
        }
      }
    })
    
    const netoReal = cobrosDia - totalComisiones - gastosDia
    
    setTotales({
      cobrosHoy: cobrosDia,
      gastosHoy: gastosDia,
      efectivoEnCaja,
      disponibleHoy: disponibleDia,
      pendienteAcreditacion,
      totalComisiones,
      netoReal
    })
    
    const acreditacionesOrdenadas = acreditacionesArray.sort((a, b) => 
      new Date(b.creado_en) - new Date(a.creado_en)
    )
    setAcreditacionesHoy(acreditacionesOrdenadas)
    
    const desgloseArray = Object.values(mediosMap).sort((a, b) => b.total - a.total)
    setDesgloseMedios(desgloseArray)
    
    setPaginas({ cobros: 1, gastos: 1, acreditaciones: 1, desglose: 1 })
  }

  const handleRefresh = () => {
    if (local) cargarCaja(local.id, fechaSeleccionada)
  }

  const handleSignOut = async () => { 
    await supabase.auth.signOut()
    router.push('/')
  }

  const formatFecha = (fecha) => {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatFechaCompleta = (fecha) => {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleString('es-AR', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit' 
    })
  }

  const toggleSeccion = (seccion) => {
    setSeccionesColapsadas(prev => ({ ...prev, [seccion]: !prev[seccion] }))
  }

  const cambiarPagina = (seccion, direccion) => {
    setPaginas(prev => {
      const paginaActual = prev[seccion]
      const nuevaPagina = direccion === 'siguiente' ? paginaActual + 1 : paginaActual - 1
      return { ...prev, [seccion]: Math.max(1, nuevaPagina) }
    })
  }

  const obtenerDatosPaginados = (datos, seccion) => {
    const pagina = paginas[seccion]
    const inicio = (pagina - 1) * ITEMS_POR_PAGINA
    const fin = inicio + ITEMS_POR_PAGINA
    return datos.slice(inicio, fin)
  }

  const obtenerTotalPaginas = (totalItems) => Math.ceil(totalItems / ITEMS_POR_PAGINA)

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">⏳</div>
        <p className="text-gray-500">Cargando caja...</p>
      </div>
    </div>
  )
  
  if (!user || !local) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">🏪</div>
        <p className="text-gray-500">Cargando local...</p>
      </div>
    </div>
  )

  const cobros = transacciones
    .filter(t => t.tipo === 'COBRO_RECIBIDO' && !t.es_reversa)
    .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
  const gastos = transacciones
    .filter(t => t.tipo === 'GASTO_REGISTRADO' && !t.es_reversa)
    .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))

  return (
    <main className="min-h-screen bg-slate-100 pb-20 md:pb-8">
      {/* ========================================== */}
      {/* HEADER SIMPLIFICADO */}
      {/* ========================================== */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="m-0 text-base md:text-lg font-bold text-gray-900 flex items-center gap-2">
              💰 {local.nombre}
            </h1>
            <p className="mt-0.5 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
              {new Date(fechaSeleccionada + 'T12:00:00').toLocaleDateString('es-AR', { 
                weekday: 'short', day: 'numeric', month: 'short' 
              })}
              {cajaAbierta && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  Abierta
                </span>
              )}
              {!cajaAbierta && esHoy && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold">
                  Cerrada
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {!isMobile && (
              <>
                <button 
                  onClick={handleRefresh}
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-200"
                >
                  🔄 Actualizar
                </button>
                <button 
                  onClick={() => setShowContactModal(true)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200"
                >
                  💬 Ayuda
                </button>
              </>
            )}
            
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
                className="p-2 bg-gray-100 text-gray-600 border-none rounded-md cursor-pointer hover:bg-gray-200"
              >
                
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-40">
                  <button 
                    onClick={(e) => { e.stopPropagation(); router.push('/admin?tab=miembros'); setShowMenu(false) }} 
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    👥 Miembros
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); router.push('/reportes'); setShowMenu(false) }} 
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                     Reportes
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); router.push('/locales'); setShowMenu(false) }} 
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    ← Volver a locales
                  </button>
                  <hr className="my-1 border-gray-200" />
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowContactModal(true); setShowMenu(false) }} 
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 md:hidden"
                  >
                    💬 Ayuda
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSignOut() }} 
                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    🚪 Salir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================== */}
      {/* BARRA DE ACCIONES COMPACTA */}
      {/* ========================================== */}
      {esHoy && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {!cajaAbierta ? (
                <button 
                  onClick={() => setShowAperturaModal(true)}
                  className="px-3 py-2 bg-emerald-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-600 shadow-sm"
                >
                  🔓 Abrir
                </button>
              ) : (
                <button 
                  onClick={() => setShowCierreModal(true)}
                  className="px-3 py-2 bg-orange-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-orange-600 shadow-sm"
                >
                  🔒 Cerrar
                </button>
              )}
              <button 
                onClick={cargarHistorialCierres}
                className="px-3 py-2 bg-indigo-100 text-indigo-700 border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-indigo-200 flex items-center gap-1"
                title="Ver historial de cierres"
              >
                 <span className="hidden md:inline">Historial</span>
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowCobroModal(true)}
                className="px-4 py-2 bg-green-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-green-600 shadow-sm"
              >
                + Cobro
              </button>
              <button 
                onClick={() => setShowGastoModal(true)}
                className="px-4 py-2 bg-red-500 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-red-600 shadow-sm"
              >
                + Gasto
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-3 md:p-4">
        {/* ========================================== */}
        {/* TARJETAS CON INFO DESPLEGABLE */}
        {/* ========================================== */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-6">
          {/* KPI Principal: Cobros */}
          <div className="bg-white rounded-xl border-2 border-green-300 p-3 md:p-4 col-span-1 relative">
            <div className="flex justify-between items-start mb-1">
              <div className="text-xs text-gray-600 font-semibold"> COBROS</div>
              <button 
                onClick={(e) => { e.stopPropagation(); setCardInfoOpen(cardInfoOpen === 'cobros' ? null : 'cobros') }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs p-1"
              >
                ℹ️
              </button>
            </div>
            <div className="text-lg md:text-2xl font-extrabold text-green-700">{formatCurrency(totales.cobrosHoy)}</div>
            <div className="text-xs text-gray-500 mt-1">{cobros.length} transacciones</div>
            
            {cardInfoOpen === 'cobros' && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
                <div className="font-semibold mb-1">📊 ¿Qué incluye?</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Todos los cobros del día</li>
                  <li>Efectivo + Tarjetas + Transferencias</li>
                  <li>Monto bruto (sin descontar comisiones)</li>
                </ul>
              </div>
            )}
          </div>
          
          {/* KPI Secundario: Neto */}
          <div className={`rounded-xl border-2 p-3 md:p-4 col-span-1 relative ${totales.netoReal >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            <div className="flex justify-between items-start mb-1">
              <div className="text-xs text-gray-600 font-semibold"> NETO</div>
              <button 
                onClick={(e) => { e.stopPropagation(); setCardInfoOpen(cardInfoOpen === 'neto' ? null : 'neto') }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs p-1"
              >
                ℹ️
              </button>
            </div>
            <div className={`text-lg md:text-2xl font-extrabold ${totales.netoReal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(totales.netoReal)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Resultado del día</div>
            
            {cardInfoOpen === 'neto' && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
                <div className="font-semibold mb-1">📊 Fórmula:</div>
                <div className="font-mono text-xs mb-1">Cobros - Comisiones - Gastos</div>
                <div className="text-xs">Tu ganancia real después de comisiones y gastos</div>
              </div>
            )}
          </div>
          
          {/* Métricas secundarias: solo desktop */}
          {!isMobile && (
            <>
              <div className="bg-white rounded-xl border-2 border-red-300 p-4 relative">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs text-gray-600 font-semibold"> GASTOS</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCardInfoOpen(cardInfoOpen === 'gastos' ? null : 'gastos') }}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs p-1"
                  >
                    ℹ️
                  </button>
                </div>
                <div className="text-2xl font-extrabold text-red-700">{formatCurrency(totales.gastosHoy)}</div>
                <div className="text-xs text-gray-500 mt-1">{gastos.length} transacciones</div>
                
                {cardInfoOpen === 'gastos' && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
                    <div className="font-semibold mb-1">📊 ¿Qué incluye?</div>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Todos los gastos registrados</li>
                      <li>Alquiler, insumos, servicios</li>
                      <li>Cualquier egreso del día</li>
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-xl border-2 border-blue-300 p-4 relative">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs text-gray-600 font-semibold">🏦 EFECTIVO</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCardInfoOpen(cardInfoOpen === 'efectivo' ? null : 'efectivo') }}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs p-1"
                  >
                    ℹ️
                  </button>
                </div>
                <div className="text-2xl font-extrabold text-blue-700">{formatCurrency(totales.efectivoEnCaja)}</div>
                <div className="text-xs text-gray-500 mt-1">Solo efectivo</div>
                
                {cardInfoOpen === 'efectivo' && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
                    <div className="font-semibold mb-1">📊 ¿Qué incluye?</div>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Solo cobros en efectivo</li>
                      <li>No incluye tarjetas</li>
                      <li>Lo que físicamente debería haber en caja</li>
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-xl border-2 border-emerald-300 p-4 relative">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs text-gray-600 font-semibold">✅ DISPONIBLE</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCardInfoOpen(cardInfoOpen === 'disponible' ? null : 'disponible') }}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs p-1"
                  >
                    ℹ️
                  </button>
                </div>
                <div className="text-2xl font-extrabold text-emerald-700">{formatCurrency(totales.disponibleHoy)}</div>
                <div className="text-xs text-gray-500 mt-1">Efectivo + acreditaciones</div>
                
                {cardInfoOpen === 'disponible' && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
                    <div className="font-semibold mb-1">📊 ¿Qué incluye?</div>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Efectivo del día</li>
                      <li>Tarjetas ya acreditadas HOY</li>
                      <li>Monto NETO (sin comisiones)</li>
                      <li>Lo que podés usar inmediatamente</li>
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-xl border-2 border-amber-300 p-4 relative">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs text-gray-600 font-semibold">⏳ PENDIENTE</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCardInfoOpen(cardInfoOpen === 'pendiente' ? null : 'pendiente') }}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs p-1"
                  >
                    ℹ️
                  </button>
                </div>
                <div className="text-2xl font-extrabold text-amber-700">{formatCurrency(totales.pendienteAcreditacion)}</div>
                <div className="text-xs text-gray-500 mt-1">Por acreditar</div>
                
                {cardInfoOpen === 'pendiente' && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
                    <div className="font-semibold mb-1">📊 ¿Qué incluye?</div>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Tarjetas de crédito (2-3 días)</li>
                      <li>Tarjetas con plazo de acreditación</li>
                      <li>Monto NETO (sin comisiones)</li>
                      <li>Dinero que viene pero no podés usar hoy</li>
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Botón "Ver más" en mobile */}
          {isMobile && (
            <button 
              onClick={() => setShowMasMetricas(!showMasMetricas)}
              className="col-span-2 bg-gray-100 text-gray-700 border-none rounded-xl p-3 text-xs font-semibold cursor-pointer hover:bg-gray-200 transition-colors"
            >
              {showMasMetricas ? '▲ Menos métricas' : '▼ Más métricas'}
            </button>
          )}
          
          {/* Métricas expandibles en mobile */}
          {isMobile && showMasMetricas && (
            <>
              <div className="bg-white rounded-xl border-2 border-red-300 p-3 relative">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs text-gray-600 font-semibold">💸 Gastos</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCardInfoOpen(cardInfoOpen === 'gastos-mobile' ? null : 'gastos-mobile') }}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs p-1"
                  >
                    ℹ️
                  </button>
                </div>
                <div className="text-base font-extrabold text-red-700">{formatCurrency(totales.gastosHoy)}</div>
                <div className="text-xs text-gray-500">{gastos.length} transacciones</div>
                {cardInfoOpen === 'gastos-mobile' && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
                    Todos los gastos registrados del día
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-xl border-2 border-blue-300 p-3 relative">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs text-gray-600 font-semibold">🏦 Efectivo</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCardInfoOpen(cardInfoOpen === 'efectivo-mobile' ? null : 'efectivo-mobile') }}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs p-1"
                  >
                    ℹ️
                  </button>
                </div>
                <div className="text-base font-extrabold text-blue-700">{formatCurrency(totales.efectivoEnCaja)}</div>
                <div className="text-xs text-gray-500">Solo efectivo</div>
                {cardInfoOpen === 'efectivo-mobile' && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
                    Solo cobros en efectivo del día
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-xl border-2 border-emerald-300 p-3 relative">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs text-gray-600 font-semibold">✅ Disponible</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCardInfoOpen(cardInfoOpen === 'disponible-mobile' ? null : 'disponible-mobile') }}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs p-1"
                  >
                    ℹ️
                  </button>
                </div>
                <div className="text-base font-extrabold text-emerald-700">{formatCurrency(totales.disponibleHoy)}</div>
                <div className="text-xs text-gray-500">Efectivo + acreditaciones</div>
                {cardInfoOpen === 'disponible-mobile' && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
                    Lo que podés usar HOY (efectivo + tarjetas acreditadas - comisiones)
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-xl border-2 border-amber-300 p-3 relative">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs text-gray-600 font-semibold">⏳ Pendiente</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCardInfoOpen(cardInfoOpen === 'pendiente-mobile' ? null : 'pendiente-mobile') }}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs p-1"
                  >
                    ℹ️
                  </button>
                </div>
                <div className="text-base font-extrabold text-amber-700">{formatCurrency(totales.pendienteAcreditacion)}</div>
                <div className="text-xs text-gray-500">Por acreditar</div>
                {cardInfoOpen === 'pendiente-mobile' && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
                    Tarjetas que acreditan en 2-3 días (monto neto sin comisiones)
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ========================================== */}
        {/* COBROS - Vista dual mobile/desktop */}
        {/* ========================================== */}
        <div className="bg-white rounded-xl border border-gray-200 mb-4 md:mb-6 overflow-hidden">
          <div 
            className="bg-green-600 p-3 text-white font-bold text-sm flex justify-between items-center cursor-pointer hover:bg-green-700 transition-colors"
            onClick={() => toggleSeccion('cobros')}
          >
            <div className="flex items-center gap-2">
              <span>💵 COBROS RECIBIDOS</span>
              <span className="text-xs font-normal bg-green-700 px-2 py-1 rounded">{cobros.length} registros</span>
            </div>
            <button className="text-white hover:text-gray-200 text-lg">
              {seccionesColapsadas.cobros ? '▼' : '▲'}
            </button>
          </div>
          
          {!seccionesColapsadas.cobros && (
            <div>
              {isMobile ? (
                <div className="divide-y divide-gray-100">
                  {cobros.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                      <div className="text-3xl mb-2"></div>
                      No hay cobros registrados
                    </div>
                  ) : (
                    cobros.slice(0, 10).map((cobro) => {
                      const estaExpandida = cardExpandida === cobro.id
                      
                      return (
                        <div key={cobro.id}>
                          <div 
                            onClick={() => setCardExpandida(estaExpandida ? null : cobro.id)}
                            className="p-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-sm font-semibold text-gray-900 truncate">
                                {cobro.medios_pago?.nombre || 'Sin medio'}
                              </span>
                              {estaExpandida && <span className="text-xs text-gray-400">▲</span>}
                            </div>
                            <div className="text-sm font-bold text-green-700 whitespace-nowrap ml-2">
                              {formatCurrency(cobro.monto || 0)}
                            </div>
                          </div>
                          
                          {estaExpandida && (
                            <div className="px-3 pb-3 bg-gray-50 border-t border-gray-100">
                              <div className="pt-2 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">🕐 Hora:</span>
                                  <span className="font-semibold text-gray-900">{formatFecha(cobro.creado_en)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">📝 Descripción:</span>
                                  <span className="font-semibold text-gray-900 text-right max-w-[60%]">
                                    {cobro.descripcion || 'Sin descripción'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">💳 Tipo:</span>
                                  <span className="font-semibold text-gray-900 capitalize">{cobro.medios_pago?.tipo || '-'}</span>
                                </div>
                                {cobro.medios_pago?.comision_porcentaje > 0 && (
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500">📉 Comisión:</span>
                                    <span className="font-semibold text-red-600">
                                      {cobro.medios_pago.comision_porcentaje}%
                                    </span>
                                  </div>
                                )}
                                <div className="pt-2 border-t border-gray-200 flex justify-end">
                                  <button
                                    onClick={(e) => { 
                                      e.stopPropagation()
                                      setTransaccionAReversar(cobro)
                                      setShowReversaModal(true)
                                    }}
                                    className="px-3 py-1.5 bg-amber-100 text-amber-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-amber-200 flex items-center gap-1"
                                  >
                                    ↩️ Cancelar transacción
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                  {cobros.length > 10 && (
                    <button 
                      onClick={() => router.push('/reportes')}
                      className="w-full py-3 text-xs text-blue-600 font-semibold hover:bg-blue-50"
                    >
                      Ver los {cobros.length - 10} restantes →
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="p-2 text-left text-gray-600 font-bold">Hora</th>
                        <th className="p-2 text-left text-gray-600 font-bold">Medio</th>
                        <th className="p-2 text-left text-gray-600 font-bold">Descripción</th>
                        <th className="p-2 text-right text-gray-600 font-bold">Monto</th>
                        <th className="p-2 text-center text-gray-600 font-bold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {obtenerDatosPaginados(cobros, 'cobros').map((cobro) => (
                        <tr key={cobro.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-2 text-gray-900">{formatFecha(cobro.creado_en)}</td>
                          <td className="p-2 text-gray-700">{cobro.medios_pago?.nombre || '-'}</td>
                          <td className="p-2 text-gray-700">{cobro.descripcion || 'Sin descripción'}</td>
                          <td className="p-2 text-right font-bold text-green-700">{formatCurrency(cobro.monto || 0)}</td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => { setTransaccionAReversar(cobro); setShowReversaModal(true) }}
                              className="px-2 py-1 bg-amber-100 text-amber-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-amber-200"
                            >
                              ️ Cancelar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {cobros.length === 0 && (
                        <tr><td colSpan="5" className="p-8 text-center text-gray-500 text-sm">No hay cobros registrados en este día</td></tr>
                      )}
                    </tbody>
                  </table>
                  {cobros.length > ITEMS_POR_PAGINA && (
                    <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                      <button onClick={() => cambiarPagina('cobros', 'anterior')} disabled={paginas.cobros === 1} className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100">← Anterior</button>
                      <span className="text-xs text-gray-600">Página {paginas.cobros} de {obtenerTotalPaginas(cobros.length)}</span>
                      <button onClick={() => cambiarPagina('cobros', 'siguiente')} disabled={paginas.cobros >= obtenerTotalPaginas(cobros.length)} className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100">Siguiente →</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* GASTOS - Vista dual mobile/desktop */}
        {/* ========================================== */}
        <div className="bg-white rounded-xl border border-gray-200 mb-4 md:mb-6 overflow-hidden">
          <div 
            className="bg-red-600 p-3 text-white font-bold text-sm flex justify-between items-center cursor-pointer hover:bg-red-700 transition-colors"
            onClick={() => toggleSeccion('gastos')}
          >
            <div className="flex items-center gap-2">
              <span>💸 GASTOS REGISTRADOS</span>
              <span className="text-xs font-normal bg-red-700 px-2 py-1 rounded">{gastos.length} registros</span>
            </div>
            <button className="text-white hover:text-gray-200 text-lg">
              {seccionesColapsadas.gastos ? '▼' : '▲'}
            </button>
          </div>
          
          {!seccionesColapsadas.gastos && (
            <div>
              {isMobile ? (
                <div className="divide-y divide-gray-100">
                  {gastos.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                      <div className="text-3xl mb-2">📭</div>
                      No hay gastos registrados
                    </div>
                  ) : (
                    gastos.slice(0, 10).map((gasto) => {
                      const estaExpandida = cardExpandida === gasto.id
                      
                      return (
                        <div key={gasto.id}>
                          <div 
                            onClick={() => setCardExpandida(estaExpandida ? null : gasto.id)}
                            className="p-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-sm font-semibold text-gray-900 truncate">
                                {gasto.descripcion || 'Sin descripción'}
                              </span>
                              {estaExpandida && <span className="text-xs text-gray-400">▲</span>}
                            </div>
                            <div className="text-sm font-bold text-red-700 whitespace-nowrap ml-2">
                              -{formatCurrency(gasto.monto || 0)}
                            </div>
                          </div>
                          
                          {estaExpandida && (
                            <div className="px-3 pb-3 bg-gray-50 border-t border-gray-100">
                              <div className="pt-2 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">🕐 Hora:</span>
                                  <span className="font-semibold text-gray-900">{formatFecha(gasto.creado_en)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">💳 Medio:</span>
                                  <span className="font-semibold text-gray-900">{gasto.medios_pago?.nombre || '-'}</span>
                                </div>
                                <div className="pt-2 border-t border-gray-200 flex justify-end">
                                  <button
                                    onClick={(e) => { 
                                      e.stopPropagation()
                                      setTransaccionAReversar(gasto)
                                      setShowReversaModal(true)
                                    }}
                                    className="px-3 py-1.5 bg-amber-100 text-amber-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-amber-200 flex items-center gap-1"
                                  >
                                    ↩️ Cancelar transacción
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="p-2 text-left text-gray-600 font-bold">Hora</th>
                        <th className="p-2 text-left text-gray-600 font-bold">Medio</th>
                        <th className="p-2 text-left text-gray-600 font-bold">Descripción</th>
                        <th className="p-2 text-right text-gray-600 font-bold">Monto</th>
                        <th className="p-2 text-center text-gray-600 font-bold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {obtenerDatosPaginados(gastos, 'gastos').map((gasto) => (
                        <tr key={gasto.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-2 text-gray-900">{formatFecha(gasto.creado_en)}</td>
                          <td className="p-2 text-gray-700">{gasto.medios_pago?.nombre || '-'}</td>
                          <td className="p-2 text-gray-700">{gasto.descripcion || 'Sin descripción'}</td>
                          <td className="p-2 text-right font-bold text-red-700">-{formatCurrency(gasto.monto || 0)}</td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => { setTransaccionAReversar(gasto); setShowReversaModal(true) }}
                              className="px-2 py-1 bg-amber-100 text-amber-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-amber-200"
                            >
                              ↩️ Cancelar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {gastos.length === 0 && (
                        <tr><td colSpan="5" className="p-8 text-center text-gray-500 text-sm">No hay gastos registrados en este día</td></tr>
                      )}
                    </tbody>
                  </table>
                  {gastos.length > ITEMS_POR_PAGINA && (
                    <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                      <button onClick={() => cambiarPagina('gastos', 'anterior')} disabled={paginas.gastos === 1} className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100">← Anterior</button>
                      <span className="text-xs text-gray-600">Página {paginas.gastos} de {obtenerTotalPaginas(gastos.length)}</span>
                      <button onClick={() => cambiarPagina('gastos', 'siguiente')} disabled={paginas.gastos >= obtenerTotalPaginas(gastos.length)} className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100">Siguiente →</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* ACREDITACIONES DEL DÍA */}
        {/* ========================================== */}
        {acreditacionesHoy.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 mb-4 md:mb-6 overflow-hidden">
            <div 
              className="bg-emerald-600 p-3 text-white font-bold text-sm flex justify-between items-center cursor-pointer hover:bg-emerald-700 transition-colors"
              onClick={() => toggleSeccion('acreditaciones')}
            >
              <div className="flex items-center gap-2">
                <span>✅ ACREDITACIONES DEL DÍA</span>
                <span className="text-xs font-normal bg-emerald-700 px-2 py-1 rounded">
                  {acreditacionesHoy.length} operaciones
                </span>
              </div>
              <button className="text-white hover:text-gray-200 text-lg">
                {seccionesColapsadas.acreditaciones ? '▼' : '▲'}
              </button>
            </div>
            
            {!seccionesColapsadas.acreditaciones && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-2 text-left text-gray-600 font-bold">Hora</th>
                      <th className="p-2 text-left text-gray-600 font-bold">Medio</th>
                      <th className="p-2 text-left text-gray-600 font-bold">Descripción</th>
                      <th className="p-2 text-right text-gray-600 font-bold">Bruto</th>
                      <th className="p-2 text-right text-gray-600 font-bold">Comisión</th>
                      <th className="p-2 text-right text-gray-600 font-bold">Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {obtenerDatosPaginados(acreditacionesHoy, 'acreditaciones').map((acred, idx) => (
                      <tr key={acred.id || idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2 text-gray-900">{formatFecha(acred.creado_en)}</td>
                        <td className="p-2 text-gray-700">{acred.medios_pago?.nombre || '-'}</td>
                        <td className="p-2 text-gray-700">{acred.descripcion || 'Sin descripción'}</td>
                        <td className="p-2 text-right text-gray-500 line-through">{formatCurrency(acred.monto || 0)}</td>
                        <td className="p-2 text-right text-red-600">-{formatCurrency(acred.comision || 0)}</td>
                        <td className="p-2 text-right font-bold text-emerald-700 bg-emerald-50">{formatCurrency((acred.monto || 0) - (acred.comision || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* DESGLOSE POR MEDIO DE PAGO */}
        {/* ========================================== */}
        {desgloseMedios.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 mb-4 md:mb-6 overflow-hidden">
            <div 
              className="bg-slate-800 p-3 text-white font-bold text-sm flex justify-between items-center cursor-pointer hover:bg-slate-900 transition-colors"
              onClick={() => toggleSeccion('desglose')}
            >
              <div className="flex items-center gap-2">
                <span>💳 DESGLOSE POR MEDIO DE PAGO</span>
                <span className="text-xs font-normal bg-slate-700 px-2 py-1 rounded">{desgloseMedios.length} medios</span>
              </div>
              <button className="text-white hover:text-gray-200 text-lg">
                {seccionesColapsadas.desglose ? '▼' : '▲'}
              </button>
            </div>
            
            {!seccionesColapsadas.desglose && (
              <div>
                {isMobile ? (
                  <div className="divide-y divide-gray-100">
                    {desgloseMedios.map((medio, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 text-sm">{medio.nombre}</div>
                          <div className="text-xs text-gray-500 capitalize">{medio.tipo} · {medio.cantidad} operaciones</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">{formatCurrency(medio.total)}</div>
                          <div className="text-xs text-red-600">-{formatCurrency(medio.comisiones)} comisión</div>
                          <div className="text-xs text-green-700 font-semibold">Neto: {formatCurrency(medio.total - medio.comisiones)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="p-2 text-left text-gray-600 font-bold">Medio</th>
                          <th className="p-2 text-right text-gray-600 font-bold">Cant.</th>
                          <th className="p-2 text-right text-gray-600 font-bold">Total</th>
                          <th className="p-2 text-right text-gray-600 font-bold">Comisiones</th>
                          <th className="p-2 text-right text-gray-600 font-bold">Neto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {obtenerDatosPaginados(desgloseMedios, 'desglose').map((medio, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-2">
                              <div className="font-semibold text-gray-900">{medio.nombre}</div>
                              <div className="text-xs text-gray-500 capitalize">{medio.tipo}</div>
                            </td>
                            <td className="p-2 text-right text-gray-700">{medio.cantidad}</td>
                            <td className="p-2 text-right font-semibold text-gray-900">{formatCurrency(medio.total)}</td>
                            <td className="p-2 text-right text-red-600">-{formatCurrency(medio.comisiones)}</td>
                            <td className="p-2 text-right font-bold text-green-700">{formatCurrency(medio.total - medio.comisiones)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* MODALES DE CAJA */}
      {/* ========================================== */}
      {showAperturaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-emerald-600 p-4 text-white">
              <h2 className="text-lg font-bold m-0">🔓 Abrir Caja</h2>
              <p className="text-xs text-white/80 m-0 mt-1">Ingresá el monto inicial de efectivo</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  💵 Efectivo inicial en caja *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Dinero en efectivo al empezar el día (vuelto, cambio, etc.)
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => { setShowAperturaModal(false); setMontoInicial('') }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAbrirCaja}
                  disabled={loadingCaja}
                  className="flex-1 px-4 py-3 bg-emerald-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-emerald-600 disabled:opacity-50"
                >
                  {loadingCaja ? 'Abriendo...' : '🔓 Abrir Caja'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCierreModal && cajaAbierta && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-orange-600 p-4 text-white">
              <h2 className="text-lg font-bold m-0">🔒 Cerrar Caja</h2>
              <p className="text-xs text-white/80 m-0 mt-1">Resumen del día y conciliación</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 mb-3"> Resumen del día</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">Monto inicial</div>
                    <div className="font-bold text-gray-900">{formatCurrency(cajaAbierta.monto_inicial_efectivo)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Cobros en efectivo</div>
                    <div className="font-bold text-green-700">+{formatCurrency(totales.efectivoEnCaja)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total cobros</div>
                    <div className="font-bold text-green-700">{formatCurrency(totales.cobrosHoy)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total gastos</div>
                    <div className="font-bold text-red-700">-{formatCurrency(totales.gastosHoy)}</div>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-gray-300">
                    <div className="text-xs text-gray-500">🏦 Efectivo esperado</div>
                    <div className="text-lg font-extrabold text-blue-700">{formatCurrency(cajaAbierta.monto_inicial_efectivo + totales.efectivoEnCaja)}</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  💵 Efectivo físico real (opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={efectivoFisico}
                  onChange={(e) => setEfectivoFisico(e.target.value)}
                  placeholder="Contá el efectivo y poné el total"
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
                {efectivoFisico !== '' && (
                  <div className={`mt-2 p-2 rounded text-xs font-semibold ${
                    parseFloat(efectivoFisico) === cajaAbierta.monto_inicial_efectivo + totales.efectivoEnCaja ? 'bg-green-100 text-green-800' :
                    parseFloat(efectivoFisico) > cajaAbierta.monto_inicial_efectivo + totales.efectivoEnCaja ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {parseFloat(efectivoFisico) === cajaAbierta.monto_inicial_efectivo + totales.efectivoEnCaja && '✅ Caja cuadrada perfecta'}
                    {parseFloat(efectivoFisico) > cajaAbierta.monto_inicial_efectivo + totales.efectivoEnCaja && ` Sobran ${formatCurrency(parseFloat(efectivoFisico) - (cajaAbierta.monto_inicial_efectivo + totales.efectivoEnCaja))}`}
                    {parseFloat(efectivoFisico) < cajaAbierta.monto_inicial_efectivo + totales.efectivoEnCaja && `📉 Faltan ${formatCurrency((cajaAbierta.monto_inicial_efectivo + totales.efectivoEnCaja) - parseFloat(efectivoFisico))}`}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Observaciones (opcional)
                </label>
                <textarea
                  value={observacionesCierre}
                  onChange={(e) => setObservacionesCierre(e.target.value)}
                  placeholder="Ej: Faltó cambio, error en sistema, etc."
                  rows="3"
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => { setShowCierreModal(false); setEfectivoFisico(''); setObservacionesCierre('') }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCerrarCaja}
                  disabled={loadingCaja}
                  className="flex-1 px-4 py-3 bg-orange-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-50"
                >
                  {loadingCaja ? 'Cerrando...' : '🔒 Cerrar Caja'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistorialModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold m-0">📋 Historial de Cierres</h2>
                <p className="text-xs text-white/80 m-0 mt-1">{local.nombre}</p>
              </div>
              <button
                onClick={() => setShowHistorialModal(false)}
                className="text-white hover:text-gray-200 text-2xl font-bold bg-none border-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {historialCierres.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">📭</div>
                  <p className="text-sm text-gray-500">No hay cierres registrados aún</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="p-2 text-left text-gray-600 font-bold">Fecha</th>
                        <th className="p-2 text-right text-gray-600 font-bold">Inicial</th>
                        <th className="p-2 text-right text-gray-600 font-bold">Cobros</th>
                        <th className="p-2 text-right text-gray-600 font-bold">Gastos</th>
                        <th className="p-2 text-right text-gray-600 font-bold">Físico</th>
                        <th className="p-2 text-right text-gray-600 font-bold">Diferencia</th>
                        <th className="p-2 text-left text-gray-600 font-bold">Obs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialCierres.map(cierre => (
                        <tr key={cierre.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-2 text-gray-900">{formatFechaCompleta(cierre.fecha_cierre)}</td>
                          <td className="p-2 text-right text-gray-700">{formatCurrency(cierre.monto_inicial_efectivo)}</td>
                          <td className="p-2 text-right text-green-700 font-semibold">{formatCurrency(cierre.total_cobrado)}</td>
                          <td className="p-2 text-right text-red-700 font-semibold">-{formatCurrency(cierre.total_gastado)}</td>
                          <td className="p-2 text-right text-gray-900">
                            {cierre.efectivo_fisico !== null ? formatCurrency(cierre.efectivo_fisico) : '-'}
                          </td>
                          <td className={`p-2 text-right font-bold ${
                            cierre.diferencia_efectivo === 0 ? 'text-green-700' :
                            cierre.diferencia_efectivo > 0 ? 'text-blue-700' : 'text-red-700'
                          }`}>
                            {cierre.diferencia_efectivo !== null ? formatCurrency(cierre.diferencia_efectivo) : '-'}
                          </td>
                          <td className="p-2 text-gray-600 max-w-[150px] truncate" title={cierre.observaciones || ''}>
                            {cierre.observaciones || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowHistorialModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* OTROS MODALES */}
      {/* ========================================== */}
      <CobroModal
        isOpen={showCobroModal}
        onClose={() => setShowCobroModal(false)}
        localId={local.id}
        userId={user.id}
        onSuccess={handleRefresh}
      />

      <GastoModal
        isOpen={showGastoModal}
        onClose={() => setShowGastoModal(false)}
        localId={local.id}
        userId={user.id}
        onSuccess={handleRefresh}
      />

      <ReversaModal
        isOpen={showReversaModal}
        onClose={() => { setShowReversaModal(false); setTransaccionAReversar(null) }}
        transaccion={transaccionAReversar}
        onReversaExitosa={handleRefresh}
      />

      <ContactModal 
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        user={user}
        localId={local.id}
        paginaOrigen="Dashboard"
      />

      {/* ========================================== */}
      {/* BOTTOM NAVIGATION (solo mobile) */}
      {/* ========================================== */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 shadow-lg">
          <div className="flex justify-around py-2 px-2">
            <button 
              onClick={() => router.push('/locales')}
              className="flex flex-col items-center gap-1 px-3 py-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <span className="text-xl">🏠</span>
              <span className="text-xs font-medium">Locales</span>
            </button>
            
            <button 
              onClick={() => setShowCobroModal(true)}
              className="flex flex-col items-center justify-center -mt-6 bg-green-500 text-white rounded-full w-14 h-14 shadow-lg hover:bg-green-600 transition-colors"
            >
              <span className="text-3xl font-bold">+</span>
            </button>
            
            <button 
              onClick={() => router.push('/reportes')}
              className="flex flex-col items-center gap-1 px-3 py-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <span className="text-xl"></span>
              <span className="text-xs font-medium">Reportes</span>
            </button>
            
            <button 
              onClick={() => setShowMobileMenu(true)}
              className="flex flex-col items-center gap-1 px-3 py-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <span className="text-xl">⚙️</span>
              <span className="text-xs font-medium">Más</span>
            </button>
          </div>
        </nav>
      )}

      {/* ========================================== */}
      {/* MODAL MENÚ MOBILE */}
      {/* ========================================== */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMobileMenu(false)}
          ></div>
          
          <div className="relative bg-white rounded-t-2xl w-full max-w-md p-6 pb-8 shadow-2xl" style={{ animation: 'slideUp 0.3s ease-out' }}>
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
            
            <h3 className="text-lg font-bold text-gray-900 mb-4">Opciones</h3>
            
            <div className="space-y-2">
              <button 
                onClick={() => { router.push('/admin?tab=miembros'); setShowMobileMenu(false) }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 flex items-center gap-3 transition-colors"
              >
                <span className="text-xl"></span>
                <span className="font-semibold">Miembros</span>
              </button>
              
              <button 
                onClick={() => { router.push('/reportes'); setShowMobileMenu(false) }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 flex items-center gap-3 transition-colors"
              >
                <span className="text-xl">📊</span>
                <span className="font-semibold">Reportes</span>
              </button>
              
              <button 
                onClick={() => { router.push('/locales'); setShowMobileMenu(false) }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 flex items-center gap-3 transition-colors"
              >
                <span className="text-xl">🏠</span>
                <span className="font-semibold">Volver a locales</span>
              </button>
              
              <hr className="my-3 border-gray-200" />
              
              <button 
                onClick={() => { setShowContactModal(true); setShowMobileMenu(false) }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 flex items-center gap-3 transition-colors"
              >
                <span className="text-xl">💬</span>
                <span className="font-semibold">Ayuda</span>
              </button>
              
              <button 
                onClick={() => { handleSignOut(); setShowMobileMenu(false) }}
                className="w-full px-4 py-3 text-left text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 flex items-center gap-3 transition-colors"
              >
                <span className="text-xl">🚪</span>
                <span className="font-semibold">Salir</span>
              </button>
            </div>
            
            <button 
              onClick={() => setShowMobileMenu(false)}
              className="w-full mt-4 px-4 py-3 bg-gray-200 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* ESTILOS INLINE PARA ANIMACIÓN */}
      {/* ========================================== */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </main>
  )
}
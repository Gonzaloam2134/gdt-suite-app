import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { formatCurrency } from '../lib/format'
import toast from 'react-hot-toast'
import ReversaModal from '../components/ReversaModal'
import ContactModal from '../components/ContactModal'
import CobroModal from '../components/CobroModal'
import GastoModal from '../components/GastoModal'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [local, setLocal] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [transacciones, setTransacciones] = useState([])
  
  // Selector de fecha
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date().toISOString().split('T')[0])
  const [esHoy, setEsHoy] = useState(true)
  
  // Totales calculados
  const [totales, setTotales] = useState({
    cobrosHoy: 0,
    gastosHoy: 0,
    efectivoEnCaja: 0,
    disponibleHoy: 0,
    pendienteAcreditacion: 0,
    totalComisiones: 0,
    netoReal: 0
  })
  
  // Acreditaciones del día (solo medios electrónicos con acreditación inmediata)
  const [acreditacionesHoy, setAcreditacionesHoy] = useState([])
  
  // Desglose por medio de pago
  const [desgloseMedios, setDesgloseMedios] = useState([])
  
  // Estados de colapso
  const [seccionesColapsadas, setSeccionesColapsadas] = useState({
    cobros: false,
    gastos: false,
    acreditaciones: false,
    desglose: false
  })
  
  // Paginación
  const [paginas, setPaginas] = useState({
    cobros: 1,
    gastos: 1,
    acreditaciones: 1,
    desglose: 1
  })
  
  const ITEMS_POR_PAGINA = 15
  
  const [showCobroModal, setShowCobroModal] = useState(false)
  const [showGastoModal, setShowGastoModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  
  // Reversas
  const [showReversaModal, setShowReversaModal] = useState(false)
  const [transaccionAReversar, setTransaccionAReversar] = useState(null)
  
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
      
      const activeLocalId = localStorage.getItem('activeLocalId')
      if (!activeLocalId) { router.push('/locales'); return }
      
      const { data: localData } = await supabase.from('locales').select('*').eq('id', activeLocalId).single()
      setLocal(localData)
      
      await cargarCaja(activeLocalId)
    })
  }, [router])

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
      
      // Calcular fecha de acreditación
      const fechaAcred = new Date(t.creado_en)
      fechaAcred.setDate(fechaAcred.getDate() + plazoDias)
      const fechaAcredStr = fechaAcred.toISOString().split('T')[0]
      
      if (t.tipo === 'COBRO_RECIBIDO' && !t.es_reversa) {
        // Total cobros del día seleccionado
        if (fechaTx === diaSeleccionado) {
          cobrosDia += t.monto || 0
        }
        
        // Efectivo en caja (solo efectivo)
        if (medio.tipo === 'efectivo') {
          efectivoEnCaja += t.monto || 0
        }
        
        // Disponible (efectivo + acreditaciones inmediatas)
        if (fechaAcredStr === diaSeleccionado) {
          disponibleDia += (t.monto || 0) - comision
        } else {
          // Pendiente de acreditación
          pendienteAcreditacion += (t.monto || 0) - comision
        }
        
        // Comisiones
        totalComisiones += comision
        
        // Acreditaciones del día (SOLO medios electrónicos con acreditación inmediata, SIN efectivo)
        if (fechaAcredStr === diaSeleccionado && medio.tipo !== 'efectivo') {
          acreditacionesArray.push({
            ...t,
            comision: comision,
            neto: (t.monto || 0) - comision
          })
        }
        
        // Desglose por medio de pago
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
    
        // Ordenar acreditaciones por hora (descendente: más reciente primero)
    const acreditacionesOrdenadas = acreditacionesArray.sort((a, b) => 
      new Date(b.creado_en) - new Date(a.creado_en)
    )
    setAcreditacionesHoy(acreditacionesOrdenadas)
    
    // Desglose por medio de pago
    const desgloseArray = Object.values(mediosMap)
      .sort((a, b) => b.total - a.total)
    
    setDesgloseMedios(desgloseArray)
    
    // Resetear paginación al cargar nuevos datos
    setPaginas({
      cobros: 1,
      gastos: 1,
      acreditaciones: 1,
      desglose: 1
    })
  }

  const handleRefresh = () => {
    if (local) cargarCaja(local.id, fechaSeleccionada)
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const formatFecha = (fecha) => {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  const toggleSeccion = (seccion) => {
    setSeccionesColapsadas(prev => ({
      ...prev,
      [seccion]: !prev[seccion]
    }))
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

  const obtenerTotalPaginas = (totalItems) => {
    return Math.ceil(totalItems / ITEMS_POR_PAGINA)
  }

  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p>Cargando caja...</p></div>
  if (!user || !local) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p>Cargando...</p></div>

    // Forzamos el orden descendente para que lo último registrado quede siempre arriba
  const cobros = transacciones
    .filter(t => t.tipo === 'COBRO_RECIBIDO' && !t.es_reversa)
    .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))

  const gastos = transacciones
    .filter(t => t.tipo === 'GASTO_REGISTRADO' && !t.es_reversa)
    .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))

  return (
    <main className="min-h-screen bg-slate-100 pb-8">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="m-0 text-lg font-bold text-gray-900">💰 Caja - {local.nombre}</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {new Date(fechaSeleccionada + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {!esHoy && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-semibold">📅 DÍA ANTERIOR</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Selector de fecha */}
            <input
              type="date"
              value={fechaSeleccionada}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                setFechaSeleccionada(e.target.value)
                cargarCaja(local.id, e.target.value)
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {!esHoy && (
              <button
                onClick={() => {
                  const hoy = new Date().toISOString().split('T')[0]
                  setFechaSeleccionada(hoy)
                  cargarCaja(local.id, hoy)
                }}
                className="px-3 py-1.5 bg-blue-500 text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-600"
              >
                📍 Ir a hoy
              </button>
            )}
            <button 
              onClick={() => setShowCobroModal(true)}
              className="px-3 py-1.5 bg-green-500 text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-green-600"
            >
              + Cobro
            </button>
            <button 
              onClick={() => setShowGastoModal(true)}
              className="px-3 py-1.5 bg-red-500 text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-red-600"
            >
              + Gasto
            </button>
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
            <button 
              onClick={() => router.push('/locales')}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200"
            >
              ← Volver
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
        {/* RESUMEN DEL DÍA */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-white rounded-xl border-2 border-green-300 p-4">
            <div className="text-xs text-gray-600 font-semibold mb-1">💰 COBROS DEL DÍA</div>
            <div className="text-xl font-extrabold text-green-700">{formatCurrency(totales.cobrosHoy)}</div>
            <div className="text-xs text-gray-500 mt-1">{cobros.length} transacciones</div>
          </div>
          
          <div className="bg-white rounded-xl border-2 border-red-300 p-4">
            <div className="text-xs text-gray-600 font-semibold mb-1">💸 GASTOS DEL DÍA</div>
            <div className="text-xl font-extrabold text-red-700">{formatCurrency(totales.gastosHoy)}</div>
            <div className="text-xs text-gray-500 mt-1">{gastos.length} transacciones</div>
          </div>
          
          <div className="bg-white rounded-xl border-2 border-blue-300 p-4">
            <div className="text-xs text-gray-600 font-semibold mb-1"> EFECTIVO EN CAJA</div>
            <div className="text-xl font-extrabold text-blue-700">{formatCurrency(totales.efectivoEnCaja)}</div>
            <div className="text-xs text-gray-500 mt-1">Solo efectivo</div>
          </div>
          
          <div className="bg-white rounded-xl border-2 border-emerald-300 p-4">
            <div className="text-xs text-gray-600 font-semibold mb-1">✅ DISPONIBLE</div>
            <div className="text-xl font-extrabold text-emerald-700">{formatCurrency(totales.disponibleHoy)}</div>
            <div className="text-xs text-gray-500 mt-1">Efectivo + acreditaciones</div>
          </div>
          
          <div className="bg-white rounded-xl border-2 border-amber-300 p-4">
            <div className="text-xs text-gray-600 font-semibold mb-1">⏳ PENDIENTE ACREDITACIÓN</div>
            <div className="text-xl font-extrabold text-amber-700">{formatCurrency(totales.pendienteAcreditacion)}</div>
            <div className="text-xs text-gray-500 mt-1">Por acreditar</div>
          </div>
          
          <div className={`rounded-xl border-2 p-4 ${totales.netoReal >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            <div className="text-xs text-gray-600 font-semibold mb-1">📊 RESULTADO NETO</div>
            <div className={`text-xl font-extrabold ${totales.netoReal >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(totales.netoReal)}</div>
            <div className="text-xs text-gray-500 mt-1">Cobros - Comisiones - Gastos</div>
          </div>
        </div>

        {/* COBROS */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
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
                          onClick={() => {
                            setTransaccionAReversar(cobro)
                            setShowReversaModal(true)
                          }}
                          className="px-2 py-1 bg-amber-100 text-amber-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-amber-200"
                          title="Cancelar transacción (reversa contable)"
                        >
                          ↩️ Cancelar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cobros.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-500 text-sm">
                        No hay cobros registrados en este día
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              
              {cobros.length > ITEMS_POR_PAGINA && (
                <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                  <button
                    onClick={() => cambiarPagina('cobros', 'anterior')}
                    disabled={paginas.cobros === 1}
                    className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    ← Anterior
                  </button>
                  <span className="text-xs text-gray-600">
                    Página {paginas.cobros} de {obtenerTotalPaginas(cobros.length)}
                  </span>
                  <button
                    onClick={() => cambiarPagina('cobros', 'siguiente')}
                    disabled={paginas.cobros >= obtenerTotalPaginas(cobros.length)}
                    className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* GASTOS */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
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
                          onClick={() => {
                            setTransaccionAReversar(gasto)
                            setShowReversaModal(true)
                          }}
                          className="px-2 py-1 bg-amber-100 text-amber-700 border-none rounded text-xs font-semibold cursor-pointer hover:bg-amber-200"
                          title="Cancelar transacción (reversa contable)"
                        >
                          ↩️ Cancelar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {gastos.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-500 text-sm">
                        No hay gastos registrados en este día
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              
              {gastos.length > ITEMS_POR_PAGINA && (
                <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                  <button
                    onClick={() => cambiarPagina('gastos', 'anterior')}
                    disabled={paginas.gastos === 1}
                    className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    ← Anterior
                  </button>
                  <span className="text-xs text-gray-600">
                    Página {paginas.gastos} de {obtenerTotalPaginas(gastos.length)}
                  </span>
                  <button
                    onClick={() => cambiarPagina('gastos', 'siguiente')}
                    disabled={paginas.gastos >= obtenerTotalPaginas(gastos.length)}
                    className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ACREDITACIONES DEL DÍA */}
        {acreditacionesHoy.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
            <div 
              className="bg-emerald-600 p-3 text-white font-bold text-sm flex justify-between items-center cursor-pointer hover:bg-emerald-700 transition-colors"
              onClick={() => toggleSeccion('acreditaciones')}
            >
              <div className="flex items-center gap-2">
                <span>✅ ACREDITACIONES DEL DÍA</span>
                <span className="text-xs font-normal bg-emerald-700 px-2 py-1 rounded">
                  {acreditacionesHoy.length} operaciones · {formatCurrency(acreditacionesHoy.reduce((sum, a) => sum + ((a.monto || 0) - (a.comision || 0)), 0))} neto
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
                      <th className="p-2 text-right text-gray-600 font-bold">Neto Acreditado</th>
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
                
                {acreditacionesHoy.length > ITEMS_POR_PAGINA && (
                  <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <button
                      onClick={() => cambiarPagina('acreditaciones', 'anterior')}
                      disabled={paginas.acreditaciones === 1}
                      className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      ← Anterior
                    </button>
                    <span className="text-xs text-gray-600">
                      Página {paginas.acreditaciones} de {obtenerTotalPaginas(acreditacionesHoy.length)}
                    </span>
                    <button
                      onClick={() => cambiarPagina('acreditaciones', 'siguiente')}
                      disabled={paginas.acreditaciones >= obtenerTotalPaginas(acreditacionesHoy.length)}
                      className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* DESGLOSE POR MEDIO DE PAGO */}
        {desgloseMedios.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
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
                
                {desgloseMedios.length > ITEMS_POR_PAGINA && (
                  <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <button
                      onClick={() => cambiarPagina('desglose', 'anterior')}
                      disabled={paginas.desglose === 1}
                      className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      ← Anterior
                    </button>
                    <span className="text-xs text-gray-600">
                      Página {paginas.desglose} de {obtenerTotalPaginas(desgloseMedios.length)}
                    </span>
                    <button
                      onClick={() => cambiarPagina('desglose', 'siguiente')}
                      disabled={paginas.desglose >= obtenerTotalPaginas(desgloseMedios.length)}
                      className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modales */}
      <CobroModal
        isOpen={showCobroModal}
        onClose={() => setShowCobroModal(false)}
        localId={local.id}
        onSuccess={handleRefresh}
      />

      <GastoModal
        isOpen={showGastoModal}
        onClose={() => setShowGastoModal(false)}
        localId={local.id}
        onSuccess={handleRefresh}
      />

      <ReversaModal
        isOpen={showReversaModal}
        onClose={() => {
          setShowReversaModal(false)
          setTransaccionAReversar(null)
        }}
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
    </main>
  )
}

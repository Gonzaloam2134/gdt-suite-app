import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { formatCurrency } from '../lib/format'
import toast from 'react-hot-toast'
import { generarReportePDF, generarReporteExcel } from '../lib/reportes'

export default function ReportesContables() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [locales, setLocales] = useState([])
  const [localSeleccionado, setLocalSeleccionado] = useState('todos')
  const [showAyudaModal, setShowAyudaModal] = useState(false)
  // Período
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date()
    d.setDate(1) // Primer día del mes
    return d.toISOString().split('T')[0]
  })
  const [fechaHasta, setFechaHasta] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    d.setDate(0) // Último día del mes
    return d.toISOString().split('T')[0]
  })
  
  // Datos
  const [resumen, setResumen] = useState({
    totalFacturado: 0,
    ivaDebitoFiscal: 0,
    netoGravado: 0,
    comisiones: 0,
    ingresoNetoReal: 0,
    gastosOperativos: 0,
    ivaCreditoFiscal: 0,
    resultadoEjercicio: 0,
    cantidadVentas: 0,
    cantidadGastos: 0,
    ivaAPagar: 0
  })
  
  const [libroVentas, setLibroVentas] = useState([])
  const [libroCompras, setLibroCompras] = useState([])
  const [cierresCaja, setCierresCaja] = useState([])
  
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
      await cargarLocales(session.user.id)
    })
  }, [router])

  useEffect(() => {
    if (user && locales.length > 0) {
      cargarReportes()
    }
  }, [fechaDesde, fechaHasta, localSeleccionado, user, locales])

  const cargarLocales = async (userId) => {
    try {
      const { data } = await supabase
        .from('miembros_locales')
        .select('local_id, rol')
        .eq('user_id', userId)
        .eq('activo', true)
      
      if (data && data.length > 0) {
        const localIds = data.map(m => m.local_id)
        const { data: localesData } = await supabase
          .from('locales')
          .select('id, nombre')
          .in('id', localIds)
        
        setLocales(localesData || [])
      }
    } catch (err) {
      console.error('Error cargando locales:', err)
    } finally {
      setLoading(false)
    }
  }

  const cargarReportes = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const inicio = new Date(fechaDesde + 'T00:00:00').toISOString()
      const fin = new Date(fechaHasta + 'T23:59:59').toISOString()
      
      // Determinar qué locales consultar
      const localesAConsultar = localSeleccionado === 'todos' 
        ? locales.map(l => l.id)
        : [localSeleccionado]
      
      // Cargar transacciones
      const { data: transacciones } = await supabase
        .from('transacciones')
        .select(`
          *,
          medios_pago (nombre, tipo, comision_porcentaje)
        `)
        .in('local_id', localesAConsultar)
        .gte('creado_en', inicio)
        .lte('creado_en', fin)
      
      // Calcular totales
      calcularResumen(transacciones || [])
      
      // Cargar cierres de caja
      const { data: cierresData } = await supabase
        .from('cierres_caja')
        .select('*')
        .in('local_id', localesAConsultar)
        .eq('estado', 'cerrada')
        .gte('fecha_cierre', inicio)
        .lte('fecha_cierre', fin)
        .order('fecha_cierre', { ascending: false })
      
      setCierresCaja(cierresData || [])
      
    } catch (err) {
      console.error('Error cargando reportes:', err)
      toast.error('Error al cargar reportes')
    } finally {
      setLoading(false)
    }
  }

  const calcularResumen = (transacciones) => {
    let totalFacturado = 0
    let ivaDebitoFiscal = 0
    let netoGravado = 0
    let comisiones = 0
    let gastosOperativos = 0
    let ivaCreditoFiscal = 0
    let cantidadVentas = 0
    let cantidadGastos = 0
    
    const libroVentasTemp = []
    const libroComprasTemp = []
    
    transacciones.forEach(t => {
      const medio = t.medios_pago || {}
      const comision = (t.monto || 0) * (medio.comision_porcentaje || 0) / 100
      const iva = (t.monto || 0) - ((t.monto || 0) / 1.21)
      const neto = (t.monto || 0) / 1.21
      
      if (t.tipo === 'COBRO_RECIBIDO' && !t.es_reversa) {
        totalFacturado += t.monto || 0
        ivaDebitoFiscal += iva
        netoGravado += neto
        comisiones += comision
        cantidadVentas++
        
        libroVentasTemp.push({
          fecha: t.creado_en,
          tipo: 'Factura A',
          punto_venta: '0001',
          numero: t.id.toString().slice(-8),
          medio: medio.nombre || '-',
          descripcion: t.descripcion || 'Venta',
          total: t.monto || 0,
          iva: iva,
          neto: neto
        })
        
      } else if (t.tipo === 'GASTO_REGISTRADO' && !t.es_reversa) {
        gastosOperativos += t.monto || 0
        ivaCreditoFiscal += iva
        cantidadGastos++
        
        libroComprasTemp.push({
          fecha: t.creado_en,
          tipo: 'Factura A',
          punto_venta: '0001',
          numero: t.id.toString().slice(-8),
          proveedor: t.descripcion || 'Proveedor',
          total: t.monto || 0,
          iva: iva,
          neto: neto
        })
      }
    })
    
    const ingresoNetoReal = totalFacturado - comisiones
    const resultadoEjercicio = ingresoNetoReal - gastosOperativos
    const ivaAPagar = ivaDebitoFiscal - ivaCreditoFiscal
    
    setResumen({
      totalFacturado,
      ivaDebitoFiscal,
      netoGravado,
      comisiones,
      ingresoNetoReal,
      gastosOperativos,
      ivaCreditoFiscal,
      resultadoEjercicio,
      cantidadVentas,
      cantidadGastos,
      ivaAPagar
    })
    
    setLibroVentas(libroVentasTemp.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)))
    setLibroCompras(libroComprasTemp.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)))
  }

  const handlePeriodoRapido = (tipo) => {
    const ahora = new Date()
    let desde = new Date()
    let hasta = new Date()
    
    switch(tipo) {
      case 'este-mes':
        desde.setDate(1)
        hasta.setMonth(hasta.getMonth() + 1)
        hasta.setDate(0)
        break
      case 'mes-anterior':
        desde.setMonth(desde.getMonth() - 1)
        desde.setDate(1)
        hasta.setDate(0)
        break
      case 'ultimos-30':
        desde.setDate(desde.getDate() - 30)
        break
      case 'trimestre':
        desde.setDate(1)
        desde.setMonth(desde.getMonth() - 2)
        break
      default:
        break
    }
    
    setFechaDesde(desde.toISOString().split('T')[0])
    setFechaHasta(hasta.toISOString().split('T')[0])
  }

    const handleExportarExcel = () => {
    try {
      generarReporteExcel(
        localSeleccionado === 'todos' ? { nombre: 'Consolidado' } : locales.find(l => l.id === localSeleccionado),
        `${fechaDesde}_a_${fechaHasta}`,
        resumen,
        libroVentas,
        libroCompras
      )
      toast.success(' Excel exportado correctamente')
    } catch (error) {
      console.error('Error exportando:', error)
      toast.error('Error al exportar')
    }
  }

  const handleExportarPDF = () => {
    try {
      generarReportePDF(
        localSeleccionado === 'todos' ? { nombre: 'Consolidado' } : locales.find(l => l.id === localSeleccionado),
        `${fechaDesde}_a_${fechaHasta}`,
        resumen,
        libroVentas,
        libroCompras
      )
      toast.success('📄 PDF exportado correctamente')
    } catch (error) {
      console.error('Error exportando:', error)
      toast.error('Error al exportar PDF')
    }
  }

  const formatFecha = (fecha) => {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p>Cargando reportes...</p></div>

  return (
    <main className="min-h-screen bg-slate-50 pb-8">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="m-0 text-xl font-bold text-gray-900">📊 Reportes Contables</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {localSeleccionado === 'todos' ? 'Todos los locales' : locales.find(l => l.id === localSeleccionado)?.nombre}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportarPDF}
              className="px-4 py-2 bg-amber-500 text-white border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-amber-600 flex items-center gap-2"
            >
              📄 Exportar PDF
            </button>
            <button 
              onClick={handleExportarExcel}
              className="px-4 py-2 bg-emerald-500 text-white border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-emerald-600 flex items-center gap-2"
            >
               Exportar Excel
            </button>
                        <button 
              onClick={() => setShowAyudaModal(true)}
              className="px-4 py-2 bg-blue-100 text-blue-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-blue-200 flex items-center gap-2"
            >
              💬 ¿Cómo leer esto?
            </button>
            <button 
              onClick={() => router.push('/locales')}
              className="px-4 py-2 bg-gray-100 text-gray-600 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200"
            >
              ← Volver
            </button>
            <button 
              onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
              className="px-4 py-2 bg-gray-100 text-gray-500 border-none rounded-lg text-sm cursor-pointer hover:bg-gray-200"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* FILTROS */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📍 Local:
            </label>
            <select
              value={localSeleccionado}
              onChange={(e) => setLocalSeleccionado(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="todos">🏢 Todos los locales (Consolidado)</option>
              {locales.map(local => (
                <option key={local.id} value={local.id}>{local.nombre}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
               Período:
            </label>
            <div className="flex gap-2 mb-3 flex-wrap">
              <button 
                onClick={() => handlePeriodoRapido('este-mes')}
                className="px-3 py-1.5 bg-blue-100 text-blue-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-200"
              >
                Este mes
              </button>
              <button 
                onClick={() => handlePeriodoRapido('mes-anterior')}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200"
              >
                Mes anterior
              </button>
              <button 
                onClick={() => handlePeriodoRapido('ultimos-30')}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200"
              >
                Últimos 30 días
              </button>
              <button 
                onClick={() => handlePeriodoRapido('trimestre')}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200"
              >
                Trimestre
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Desde:</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Hasta:</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RESUMEN EJECUTIVO */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-slate-800 p-4">
            <h2 className="text-white font-bold m-0">RESUMEN EJECUTIVO</h2>
          </div>
          
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Total Facturado (bruto)</span>
              <span className="font-bold text-gray-900">{formatCurrency(resumen.totalFacturado)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">(-) IVA Débito Fiscal</span>
              <span className="font-bold text-red-600">-${formatCurrency(resumen.ivaDebitoFiscal)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Neto Gravado</span>
              <span className="font-bold text-gray-900">{formatCurrency(resumen.netoGravado)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">(-) Comisiones de medios de pago</span>
              <span className="font-bold text-red-600">-${formatCurrency(resumen.comisiones)}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b-2 border-gray-300 bg-slate-50 px-3 -mx-3">
              <span className="text-sm font-bold text-gray-900">INGRESO NETO REAL</span>
              <span className="font-extrabold text-lg text-emerald-600">{formatCurrency(resumen.ingresoNetoReal)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">(-) Gastos operativos</span>
              <span className="font-bold text-red-600">-${formatCurrency(resumen.gastosOperativos)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">(-) IVA Crédito Fiscal (compras)</span>
              <span className="font-bold text-gray-500">-${formatCurrency(resumen.ivaCreditoFiscal)}</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b-2 border-gray-300 bg-emerald-50 px-3 -mx-3">
              <span className="text-base font-bold text-gray-900">RESULTADO DEL EJERCICIO</span>
              <span className="font-extrabold text-2xl text-emerald-600">{formatCurrency(resumen.resultadoEjercicio)}</span>
            </div>
            
            {/* TARJETAS INFERIORES */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">Ventas</div>
                <div className="text-2xl font-bold text-gray-900">{resumen.cantidadVentas}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">Gastos</div>
                <div className="text-2xl font-bold text-gray-900">{resumen.cantidadGastos}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">IVA a pagar</div>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(resumen.ivaAPagar)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* LIBRO IVA VENTAS */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-amber-500 p-4 flex justify-between items-center">
            <h2 className="text-white font-bold m-0">📘 LIBRO IVA VENTAS (Débito Fiscal)</h2>
            <span className="text-xs text-white/80">{libroVentas.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-2 text-left text-gray-600 font-bold">Fecha</th>
                  <th className="p-2 text-left text-gray-600 font-bold">Tipo</th>
                  <th className="p-2 text-left text-gray-600 font-bold">Nro.</th>
                  <th className="p-2 text-left text-gray-600 font-bold">Medio</th>
                  <th className="p-2 text-left text-gray-600 font-bold">Descripción</th>
                  <th className="p-2 text-right text-gray-600 font-bold">Total</th>
                  <th className="p-2 text-right text-gray-600 font-bold">IVA</th>
                  <th className="p-2 text-right text-gray-600 font-bold">Neto</th>
                </tr>
              </thead>
              <tbody>
                {libroVentas.slice(0, 50).map((venta, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-2">{formatFecha(venta.fecha)}</td>
                    <td className="p-2">{venta.tipo}</td>
                    <td className="p-2">{venta.numero}</td>
                    <td className="p-2">{venta.medio}</td>
                    <td className="p-2">{venta.descripcion}</td>
                    <td className="p-2 text-right font-semibold">{formatCurrency(venta.total)}</td>
                    <td className="p-2 text-right text-red-600">{formatCurrency(venta.iva)}</td>
                    <td className="p-2 text-right">{formatCurrency(venta.neto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* LIBRO IVA COMPRAS */}
        {libroCompras.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-emerald-600 p-4 flex justify-between items-center">
              <h2 className="text-white font-bold m-0">📗 LIBRO IVA COMPRAS (Crédito Fiscal)</h2>
              <span className="text-xs text-white/80">{libroCompras.length} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-2 text-left text-gray-600 font-bold">Fecha</th>
                    <th className="p-2 text-left text-gray-600 font-bold">Tipo</th>
                    <th className="p-2 text-left text-gray-600 font-bold">Nro.</th>
                    <th className="p-2 text-left text-gray-600 font-bold">Proveedor</th>
                    <th className="p-2 text-right text-gray-600 font-bold">Total</th>
                    <th className="p-2 text-right text-gray-600 font-bold">IVA</th>
                    <th className="p-2 text-right text-gray-600 font-bold">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {libroCompras.slice(0, 50).map((compra, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2">{formatFecha(compra.fecha)}</td>
                      <td className="p-2">{compra.tipo}</td>
                      <td className="p-2">{compra.numero}</td>
                      <td className="p-2">{compra.proveedor}</td>
                      <td className="p-2 text-right font-semibold">{formatCurrency(compra.total)}</td>
                      <td className="p-2 text-right text-emerald-600">{formatCurrency(compra.iva)}</td>
                      <td className="p-2 text-right">{formatCurrency(compra.neto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
      {/* ========================================== */}
      {/* MODAL DE AYUDA / GUÍA DE LECTURA */}
      {/* ========================================== */}
      {showAyudaModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white sticky top-0 z-10">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold m-0 flex items-center gap-2">
                  📖 Guía de Lectura
                </h2>
                <button 
                  onClick={() => setShowAyudaModal(false)}
                  className="text-white/80 hover:text-white text-2xl font-bold bg-none border-none cursor-pointer"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-blue-100 m-0 mt-1">
                Entendé tu reporte contable en palabras simples
              </p>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-6">
              
              {/* Sección 1: Resumen */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center text-sm">1</span>
                  Resumen Ejecutivo (La foto grande)
                </h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                  <div className="flex gap-3">
                    <div className="text-lg">💰</div>
                    <div>
                      <div className="font-bold text-sm text-gray-900">Total Facturado (Bruto)</div>
                      <div className="text-xs text-gray-600">Es todo el dinero que entró por ventas, <strong>incluyendo el IVA</strong> que le cobraste al cliente.</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="text-lg">🏛️</div>
                    <div>
                      <div className="font-bold text-sm text-gray-900">IVA Débito Fiscal</div>
                      <div className="text-xs text-gray-600">Es el IVA que <strong>vos le cobraste a tus clientes</strong>. Ese dinero no es tuyo, tenés que pagárselo a AFIP.</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="text-lg">💵</div>
                    <div>
                      <div className="font-bold text-sm text-gray-900">Ingreso Neto Real</div>
                      <div className="text-xs text-gray-600">Lo que realmente te queda después de quitarle el IVA y pagarle las comisiones a las tarjetas (Mercado Pago, Visa, etc.).</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="text-lg">📉</div>
                    <div>
                      <div className="font-bold text-sm text-gray-900">Resultado del Ejercicio</div>
                      <div className="text-xs text-gray-600">La ganancia (o pérdida) real de tu negocio en este período. <strong>(Ingresos - Gastos)</strong>.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 2: Libros IVA */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="bg-amber-100 text-amber-700 w-7 h-7 rounded-full flex items-center justify-center text-sm">2</span>
                  Libros IVA (Lo que le interesa a tu contador)
                </h3>
                <div className="bg-amber-50 rounded-xl p-4 space-y-3 border border-amber-200">
                  <div className="flex gap-3">
                    <div className="text-lg">📘</div>
                    <div>
                      <div className="font-bold text-sm text-gray-900">Libro IVA Ventas (Débito Fiscal)</div>
                      <div className="text-xs text-gray-600">El registro de todas tus ventas. Muestra cuánto IVA "debés" al fisco por cada factura emitida.</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="text-lg">📗</div>
                    <div>
                      <div className="font-bold text-sm text-gray-900">Libro IVA Compras (Crédito Fiscal)</div>
                      <div className="text-xs text-gray-600">El registro de tus gastos e insumos. El IVA que pagaste acá <strong>se resta</strong> del IVA de ventas para pagarle menos a AFIP.</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="text-lg">⚖️</div>
                    <div>
                      <div className="font-bold text-sm text-gray-900">IVA a Pagar</div>
                      <div className="text-xs text-gray-600">La diferencia entre el IVA que cobraste y el que pagaste. Si es positivo, le pagás a AFIP. Si es negativo, tenés saldo a favor.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 3: Consejos */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="bg-emerald-100 text-emerald-700 w-7 h-7 rounded-full flex items-center justify-center text-sm">3</span>
                  💡 Consejos para fin de mes
                </h3>
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                  <ul className="text-xs text-gray-700 space-y-2 m-0 pl-4">
                    <li>✅ <strong>Revisá el "IVA a pagar":</strong> Si es muy alto, quizás te faltó cargar gastos con factura para tener más Crédito Fiscal.</li>
                    <li>✅ <strong>Compará meses:</strong> Usá los botones "Mes anterior" y "Este mes" para ver si tu negocio crece o baja.</li>
                    <li>✅ <strong>Exportá el Excel:</strong> Mandale este archivo a tu contador. Ya está formateado y listo para presentar.</li>
                    <li>✅ <strong>Controlá las comisiones:</strong> En "Resumen por Medio de Pago" podés ver cuánto te están comiendo las tarjetas.</li>
                  </ul>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end sticky bottom-0">
              <button 
                onClick={() => setShowAyudaModal(false)}
                className="px-5 py-2 bg-blue-600 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-700"
              >
                Entendido, cerrar
              </button>
            </div>

          </div>
        </div>
      )}
    </main>
  )
}
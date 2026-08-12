import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'
import { formatCurrency } from '../lib/format'
import toast from 'react-hot-toast'
import RoleGate from '../components/RoleGate'
import InviteUserModal from '../components/InviteUserModal'

const CONCEPTOS_INGRESO = ['Venta de mostrador', 'Venta por Delivery', 'Pedido / Encargo', 'Servicios', 'Otro ingreso']
const CONCEPTOS_GASTO = ['Compra de insumos/proveedores', 'Servicios (Luz, Gas, Internet)', 'Sueldos / Jornales', 'Alquiler', 'Impuestos', 'Otros egresos']

const BANCOS_ARGENTINA = [
  'Galicia', 'Santander Río', 'BBVA', 'Macro', 'Nación', 'ICBC',
  'Brubank', 'Supervielle', 'HSBC', 'Citibank', 'Patagonia',
  'Provincia', 'Ciudad', 'Comafi', 'Hipotecario', 'Itaú',
  'BMA', 'Credicoop', 'Industrial', 'BICA'
]

export default function CajaDelDia() {
  const [user, setUser] = useState(null)
  const [businessName, setBusinessName] = useState('Mi Negocio')
  const [condicionFiscal, setCondicionFiscal] = useState('')
  const [movements, setMovements] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('INCOME')
  const [activeShift, setActiveShift] = useState(null)
  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  
  const [amount, setAmount] = useState('')
  const [selectedConcept, setSelectedConcept] = useState('')
  const [customConcept, setCustomConcept] = useState('')
  const [showCustomConcept, setShowCustomConcept] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState('')
  
  const [openingAmount, setOpeningAmount] = useState('')
  const [lastShiftBalance, setLastShiftBalance] = useState(0)
  const [differenceReason, setDifferenceReason] = useState('')
  const [isAmountModified, setIsAmountModified] = useState(false)
  const [creating, setCreating] = useState(false)

  const [showQuickAddMethod, setShowQuickAddMethod] = useState(false)
  const [quickMethodCategory, setQuickMethodCategory] = useState('')
  const [quickMethodSubcategory, setQuickMethodSubcategory] = useState('')
  const [quickMethodBanco, setQuickMethodBanco] = useState('')
  const [quickMethodHasCommission, setQuickMethodHasCommission] = useState(false)
  const [quickMethodCommissionPct, setQuickMethodCommissionPct] = useState('')
  const [quickMethodDiasAcreditacion, setQuickMethodDiasAcreditacion] = useState('0')
  
  const [showNewCategoryQuick, setShowNewCategoryQuick] = useState(false)
  const [showNewOperatorQuick, setShowNewOperatorQuick] = useState(false)
  const [showNewBancoQuick, setShowNewBancoQuick] = useState(false)
  const [newCategoryQuickName, setNewCategoryQuickName] = useState('')
  const [newOperatorQuickName, setNewOperatorQuickName] = useState('')
  const [newBancoQuickName, setNewBancoQuickName] = useState('')

  const [expandedAccreditation, setExpandedAccreditation] = useState(null)
  
  // Navegación por fechas
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [isViewingHistory, setIsViewingHistory] = useState(false)
  
  // Acreditaciones del día (todas las transacciones del local)
  const [acreditacionesHoy, setAcreditacionesHoy] = useState([])
  
  const router = useRouter()
  const activeLocalId = typeof window !== 'undefined' ? localStorage.getItem('activeLocalId') : null

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        if (activeLocalId) {
          loadData(session.user.id)
        } else {
          router.push('/locales')
        }
      }
    })
  }, [router, activeLocalId])

  // Cargar datos cuando cambia la fecha seleccionada
  useEffect(() => {
    if (user && activeLocalId) {
      loadDataForDate(user.id, selectedDate)
    }
  }, [selectedDate])

  const loadData = async (userId) => {
    try {
      setLoading(true)
      const { data: localData } = await supabase.from('locales').select('nombre, condicion_fiscal').eq('id', activeLocalId).single()
      if (localData) {
        setBusinessName(localData.nombre)
        setCondicionFiscal(localData.condicion_fiscal || '')
      }

      const { data: shiftData } = await supabase.from('turnos').select('*').eq('local_id', activeLocalId).eq('estado', 'ABIERTO').order('abierto_en', { ascending: false }).limit(1).single()
      setActiveShift(shiftData || null)

      if (shiftData) {
        const { data: txData } = await supabase.from('transacciones').select('*').eq('turno_id', shiftData.id).order('creado_en', { ascending: false }).limit(100)
        setMovements(txData || [])
      } else { setMovements([]) }

      const { data: closedData } = await supabase.from('turnos').select('*').eq('local_id', activeLocalId).eq('estado', 'CERRADO').order('cerrado_en', { ascending: false }).limit(10)

      if (closedData && closedData.length > 0) {
        const lastClosed = closedData[0]
        const { data: lastTx } = await supabase.from('transacciones').select('monto, comision_monto, tipo, medio_pago_id').eq('turno_id', lastClosed.id)
        let calculatedBalance = lastClosed.monto_inicial || 0
        if (lastTx) {
          lastTx.forEach(tx => {
            const isIncome = tx.tipo === 'COBRO_RECIBIDO' || tx.tipo === 'CAJA_ABIERTA'
            if (isIncome) calculatedBalance += (tx.monto - (tx.comision_monto || 0))
            else calculatedBalance -= tx.monto
          })
        }
        setLastShiftBalance(calculatedBalance)
        setOpeningAmount(calculatedBalance.toFixed(2))
        setIsAmountModified(false)
        setDifferenceReason('')
      } else { setLastShiftBalance(0); setOpeningAmount('') }
      
      const { data: pmData } = await supabase.from('medios_pago').select(`*, subcategorias_pago (id, nombre, categorias_pago (id, nombre, icono))`).eq('local_id', activeLocalId).eq('activo', true).order('creado_en', { ascending: false })
      setPaymentMethods(pmData || [])

      const { data: catData } = await supabase.from('categorias_pago').select('*').eq('activo', true).order('orden', { ascending: true })
      const { data: subcatData } = await supabase.from('subcategorias_pago').select('*').eq('activo', true).order('nombre', { ascending: true })
      setCategories(catData || [])
      setSubcategories(subcatData || [])
      
      // Cargar acreditaciones del día (todas las transacciones del local que se acreditan hoy)
      const hoyStr = new Date().toISOString().split('T')[0]
      const { data: allTx } = await supabase
        .from('transacciones')
        .select('*')
        .eq('local_id', activeLocalId)
        .eq('tipo', 'COBRO_RECIBIDO')
        .eq('fecha_acreditacion_estimada', hoyStr)
      
      const acreditaciones = (allTx || []).map(m => ({ 
        ...m, 
        method: (pmData || []).find(pm => pm.id === m.medio_pago_id), 
        net: m.monto - (m.comision_monto || 0) 
      }))
      setAcreditacionesHoy(acreditaciones)
      
    } catch (err) { console.error('Error cargando datos:', err) } finally { setLoading(false) }
  }

  // Cargar datos para una fecha específica
  const loadDataForDate = async (userId, date) => {
    try {
      setLoading(true)
      setIsViewingHistory(false)
      
      const { data: localData } = await supabase.from('locales').select('nombre, condicion_fiscal').eq('id', activeLocalId).single()
      if (localData) {
        setBusinessName(localData.nombre)
        setCondicionFiscal(localData.condicion_fiscal || '')
      }

      // Buscar turno para esa fecha
      const dateStart = `${date}T00:00:00`
      const dateEnd = `${date}T23:59:59`
      
      const { data: shiftData } = await supabase
        .from('turnos')
        .select('*')
        .eq('local_id', activeLocalId)
        .gte('abierto_en', dateStart)
        .lte('abierto_en', dateEnd)
        .order('abierto_en', { ascending: false })
        .limit(1)
        .single()

      if (shiftData) {
        setActiveShift(shiftData)
        
        // Si el turno es cerrado, marcar como histórico
        if (shiftData.estado === 'CERRADO') {
          setIsViewingHistory(true)
        }
        
        const { data: txData } = await supabase
          .from('transacciones')
          .select('*')
          .eq('turno_id', shiftData.id)
          .order('creado_en', { ascending: false })
          .limit(200)
        setMovements(txData || [])
      } else {
        // No hay turno para esa fecha
        setActiveShift(null)
        setMovements([])
        if (date !== new Date().toISOString().split('T')[0]) {
          toast(`No hay registro de actividad para el ${new Date(date).toLocaleDateString('es-AR')}`, {
            icon: '📭'
          })
        }
      }

      const { data: pmData } = await supabase.from('medios_pago').select(`*, subcategorias_pago (id, nombre, categorias_pago (id, nombre, icono))`).eq('local_id', activeLocalId).eq('activo', true).order('creado_en', { ascending: false })
      setPaymentMethods(pmData || [])
    } catch (err) { 
      console.error('Error cargando datos para fecha:', err)
    } finally { 
      setLoading(false) 
    }
  }

  const handleDateChange = (e) => {
    const newDate = e.target.value
    setSelectedDate(newDate)
    
    // Si selecciona hoy, volver al modo normal
    if (newDate === new Date().toISOString().split('T')[0]) {
      setIsViewingHistory(false)
    }
  }

  const handleGoToToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setSelectedDate(today)
    setIsViewingHistory(false)
    loadData(user.id)
  }

  const hoy = new Date()
  const hoyStr = hoy.toISOString().split('T')[0]

  const efectivoMethod = paymentMethods.find(m => m.nombre?.toLowerCase().includes('efectivo') || m.nombre?.toLowerCase().includes('cash') || (!m.banco_emisor && !m.subcategorias_pago?.nombre))
  const efectivoMethodId = efectivoMethod?.id

  const cobrosEfectivo = movements.filter(m => m.tipo === 'COBRO_RECIBIDO' && m.medio_pago_id === efectivoMethodId).reduce((sum, m) => sum + m.monto, 0)
  const gastosEfectivo = movements.filter(m => m.tipo === 'GASTO_REGISTRADO' && m.medio_pago_id === efectivoMethodId).reduce((sum, m) => sum + m.monto, 0)
  const efectivoEnCaja = (activeShift?.monto_inicial || 0) + cobrosEfectivo - gastosEfectivo

  const transferenciasInmediatas = movements.filter(m => {
    if (m.tipo !== 'COBRO_RECIBIDO' || m.medio_pago_id === efectivoMethodId) return false
    return (m.fecha_acreditacion_estimada || hoyStr) === hoyStr
  }).reduce((sum, m) => sum + (m.monto - (m.comision_monto || 0)), 0)

  const totalAcreditacionesHoy = acreditacionesHoy.reduce((sum, m) => sum + m.net, 0)
  const totalDisponibleHoy = efectivoEnCaja + transferenciasInmediatas + totalAcreditacionesHoy

  const enTransito = movements.filter(m => {
    if (m.tipo !== 'COBRO_RECIBIDO' || m.medio_pago_id === efectivoMethodId) return false
    return (m.fecha_acreditacion_estimada || hoyStr) > hoyStr
  }).reduce((sum, m) => sum + (m.monto - (m.comision_monto || 0)), 0)

  const balanceByMethod = paymentMethods.map(method => {
    const methodMovements = movements.filter(m => m.medio_pago_id === method.id)
    const income = methodMovements.filter(m => m.tipo === 'COBRO_RECIBIDO').reduce((sum, m) => sum + m.monto, 0)
    const expenses = methodMovements.filter(m => m.tipo === 'GASTO_REGISTRADO').reduce((sum, m) => sum + m.monto, 0)
    const commissions = methodMovements.filter(m => m.tipo === 'COBRO_RECIBIDO').reduce((sum, m) => sum + (m.comision_monto || 0), 0)
    return { method, income, expenses, commissions, netBalance: income - commissions - expenses }
  }).filter(b => b.income > 0 || b.expenses > 0)

  const handleOpenForm = (type) => {
    setFormType(type); setAmount(''); setSelectedConcept(''); setCustomConcept(''); setShowCustomConcept(false); setSelectedMethod(''); setShowForm(true); setShowQuickAddMethod(false)
  }

  const handleOpeningAmountChange = (e) => {
    const newVal = e.target.value
    setOpeningAmount(newVal)
    if (lastShiftBalance > 0 && newVal !== lastShiftBalance.toFixed(2)) { setIsAmountModified(true) } 
    else { setIsAmountModified(false); setDifferenceReason('') }
  }

  const handleOpenShift = async (e) => {
    e.preventDefault()
    if (!openingAmount || parseFloat(openingAmount) < 0) { toast.error('Ingresá un monto válido'); return }
    if (lastShiftBalance > 0 && isAmountModified && !differenceReason.trim()) { toast.error('Explicá el motivo de la diferencia'); return }
    try {
      setCreating(true)
      let { data: businesses } = await supabase.from('negocios').select('id').eq('local_id', activeLocalId).limit(1)
      let bizId = businesses?.[0]?.id
      if (!bizId) {
        const { data: newBiz } = await supabase.from('negocios').insert([{ local_id: activeLocalId, nombre: 'Principal', razon_social: 'Negocio Principal', cuit: '00-00000000-0' }]).select('id').single()
        bizId = newBiz.id
      }
      let { data: branches } = await supabase.from('sucursales').select('id').eq('negocio_id', bizId).limit(1)
      let branchId = branches?.[0]?.id
      if (!branchId) {
        const { data: newBranch } = await supabase.from('sucursales').insert([{ negocio_id: bizId, nombre: 'Sucursal Principal', codigo: 'SUC-01' }]).select('id').single()
        branchId = newBranch.id
      }
      let { data: cashPoints } = await supabase.from('cajas').select('id').eq('sucursal_id', branchId).limit(1)
      let cashPointId = cashPoints?.[0]?.id
      if (!cashPointId) {
        const { data: newCP } = await supabase.from('cajas').insert([{ sucursal_id: branchId, nombre: 'Caja Principal', codigo: 'CAJA-01' }]).select('id').single()
        cashPointId = newCP.id
      }

      const { error } = await supabase.from('turnos').insert([{
        local_id: activeLocalId, negocio_id: bizId, sucursal_id: branchId, caja_id: cashPointId,
        abierto_por: user.id, estado: 'ABIERTO', monto_inicial: parseFloat(openingAmount),
        motivo_diferencia_apertura: isAmountModified ? differenceReason : null
      }]).select().single()

      if (error) throw error
      toast.success('Caja abierta correctamente')
      setShowOpenShift(false); setOpeningAmount(''); setDifferenceReason(''); setIsAmountModified(false)
      loadData(user.id)
    } catch (err) { toast.error('Error: ' + err.message) } finally { setCreating(false) }
  }

  const handleCloseShift = async () => {
    if (!activeShift) return
    try {
      setCreating(true)
      const { error } = await supabase.from('turnos').update({ estado: 'CERRADO', cerrado_en: new Date().toISOString(), cerrado_por: user.id }).eq('id', activeShift.id)
      if (error) throw error
      toast.success('Caja cerrada correctamente')
      setShowCloseShift(false); setActiveShift(null); setMovements([])
      loadData(user.id)
    } catch (err) { toast.error('Error: ' + err.message) } finally { setCreating(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || amount <= 0) { toast.error('Ingresá un monto válido'); return }
    if (!selectedMethod) { toast.error('Seleccioná un medio de pago'); return }
    if (!activeShift) { toast.error('Primero abrí la caja'); return }

    try {
      setCreating(true)
      const method = paymentMethods.find(m => m.id === selectedMethod)
      const isIncome = formType === 'INCOME'
      const tipo = isIncome ? 'COBRO_RECIBIDO' : 'GASTO_REGISTRADO'
      const commission = isIncome && method.tipo_comision === 'PORCENTAJE' ? (parseFloat(amount) * (method.valor_comision || 0)) / 100 : 0
      const finalConcept = showCustomConcept ? customConcept : selectedConcept

      let montoNeto = parseFloat(amount), montoIva = 0, alicuotaIva = 0
      if (isIncome && condicionFiscal === 'Responsable Inscripto') {
        alicuotaIva = 21
        montoNeto = parseFloat(amount) / (1 + (alicuotaIva / 100))
        montoIva = parseFloat(amount) - montoNeto
      }

      const diasAcreditacion = method.dias_acreditacion || 0
      const fechaAcreditacion = new Date()
      fechaAcreditacion.setDate(fechaAcreditacion.getDate() + diasAcreditacion)
      const fechaAcreditacionStr = fechaAcreditacion.toISOString().split('T')[0]

      const { error } = await supabase.from('transacciones').insert([{
        turno_id: activeShift.id, local_id: activeLocalId, negocio_id: activeShift.negocio_id,
        sucursal_id: activeShift.sucursal_id, caja_id: activeShift.caja_id, tipo, monto: parseFloat(amount),
        comision_monto: commission, medio_pago_id: method.id, estado_pago: 'ACREDITADO',
        descripcion: finalConcept || (isIncome ? 'Venta' : 'Gasto'), categoria: finalConcept || (isIncome ? 'Ventas' : 'Gastos'),
        creado_por: user.id, fecha_acreditacion_estimada: isIncome ? fechaAcreditacionStr : hoyStr,
        alicuota_iva: alicuotaIva, monto_iva: montoIva, monto_neto: isIncome ? montoNeto : parseFloat(amount)
      }])

      if (error) throw error
      toast.success(`${isIncome ? 'Venta' : 'Gasto'} registrado correctamente`)
      setShowForm(false)
      loadData(user.id)
    } catch (err) { toast.error('Error: ' + err.message) } finally { setCreating(false) }
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/') }

  // Funciones helper para iconos y labels de medios de pago
  const getMedioPagoIcono = (method) => {
    if (!method) return '💳'
    
    const nombre = method.nombre?.toLowerCase() || ''
    
    if (nombre.includes('efectivo') || nombre.includes('cash')) return '💵'
    if (nombre.includes('débito') || nombre.includes('debit')) return '💳'
    if (nombre.includes('crédito') || nombre.includes('credito') || nombre.includes('visa') || nombre.includes('master')) return '💳'
    if (nombre.includes('qr') || nombre.includes('mercado pago') || nombre.includes('modo')) return '📱'
    if (nombre.includes('transferencia')) return ''
    
    return '💳'
  }

  const getMedioPagoLabel = (method) => {
    if (!method) return 'Medio de pago'
    
    const nombre = method.nombre?.toLowerCase() || ''
    
    if (nombre.includes('efectivo') || nombre.includes('cash')) return 'Efectivo'
    if (nombre.includes('débito') || nombre.includes('debit')) return 'Débito'
    if (nombre.includes('crédito') || nombre.includes('credito')) return 'Crédito'
    if (nombre.includes('qr') || nombre.includes('mercado pago')) return 'QR'
    if (nombre.includes('modo')) return 'QR'
    if (nombre.includes('transferencia')) return 'Transferencia'
    
    return method.nombre
  }

  if (loading) return <div className="p-8 text-center text-sm">Cargando...</div>

  const conceptosList = formType === 'INCOME' ? CONCEPTOS_INGRESO : CONCEPTOS_GASTO
  const filteredSubcategories = subcategories.filter(s => s.categoria_id === quickMethodCategory)

  return (
    <main className="p-0 font-sans bg-slate-100 min-h-screen pb-[70px]">
      <header className="bg-white p-4 border-b border-gray-200 sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div>
            <h1 className="m-0 text-lg text-gray-900 font-bold">{businessName}</h1>
            <p className="mt-0.5 text-xs text-gray-500">{activeShift ? `Turno activo - ${new Date().toLocaleDateString('es-AR')}` : 'Caja cerrada'}</p>
          </div>
          <div className="flex gap-1">
            <RoleGate allowedRoles={['owner', 'super_user']}>
              <button onClick={() => router.push('/reportes')} className="px-2.5 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 cursor-pointer text-xs hover:bg-gray-200">Reportes</button>
            </RoleGate>
            <RoleGate allowedRoles={['owner']}>
              <button onClick={() => setShowInviteModal(true)} className="px-2.5 py-1.5 bg-blue-100 border-none rounded-md text-blue-700 cursor-pointer text-xs font-semibold hover:bg-blue-200">👥 Invitar</button>
            </RoleGate>
            <button onClick={handleSignOut} className="px-2.5 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 cursor-pointer text-xs">Salir</button>
          </div>
        </div>
      </header>

      {/* Selector de fecha */}
      <div className="bg-white border-b border-gray-200 p-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-700"> Fecha:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            max={new Date().toISOString().split('T')[0]}
            className="px-3 py-1.5 border-2 border-gray-200 rounded-lg text-sm font-medium focus:border-blue-500 focus:outline-none"
          />
          {isViewingHistory && (
            <button
              onClick={handleGoToToday}
              className="px-3 py-1.5 bg-blue-500 text-white border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-blue-600"
            >
              Ir a hoy
            </button>
          )}
          {isViewingHistory && (
            <span className="text-xs text-amber-600 font-semibold">📜 Modo histórico</span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {!activeShift ? (
          <div className="text-center p-8 bg-white rounded-xl border-2 border-dashed border-gray-300 mb-4">
            <div className="text-5xl mb-2">🔒</div>
            <h3 className="m-0 mb-2 text-gray-900 text-base">Caja Cerrada</h3>
            <p className="m-0 mb-4 text-gray-500 text-sm">Abrí la caja para empezar a operar</p>
            <RoleGate allowedRoles={['owner', 'cajero']}>
              <button onClick={() => setShowOpenShift(true)} className="px-6 py-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">Abrir Caja</button>
            </RoleGate>
            <RoleGate allowedRoles={['empleado']}>
              <p className="text-xs text-gray-400 mt-2">Esperá a que el dueño o cajero abra la caja.</p>
            </RoleGate>
          </div>
        ) : (
          <>
            <div className="bg-white p-4 rounded-xl border border-gray-200 mb-4">
              <h2 className="m-0 mb-3 text-base text-gray-900 font-bold">Resumen del Turno</h2>
              <div className="space-y-3">
                <RoleGate allowedRoles={['owner', 'cajero', 'super_user']}>
                  <div className="bg-green-50 p-3 rounded-lg border-2 border-green-600">
                    <div className="text-xs text-green-800 font-bold mb-1">💵 EFECTIVO EN CAJA</div>
                    <div className="text-xl font-extrabold text-green-700">{formatCurrency(efectivoEnCaja)}</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg border-2 border-blue-600">
                    <div className="text-xs text-blue-800 font-bold mb-1">⚡ TRANSFERENCIAS INMEDIATAS</div>
                    <div className="text-xl font-extrabold text-blue-700">{formatCurrency(transferenciasInmediatas)}</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg border-2 border-purple-600">
                    <div className="text-xs text-purple-800 font-bold mb-1">📥 ACREDITACIONES DEL DÍA</div>
                    <div className="text-xl font-extrabold text-purple-700">{formatCurrency(totalAcreditacionesHoy)}</div>
                  </div>
                  <div className="bg-emerald-100 p-4 rounded-lg border-2 border-emerald-700">
                    <div className="text-sm text-emerald-900 font-bold mb-1">✅ TOTAL DISPONIBLE HOY</div>
                    <div className="text-2xl font-extrabold text-emerald-800">{formatCurrency(totalDisponibleHoy)}</div>
                  </div>
                  {enTransito > 0 && (
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-300">
                      <div className="text-xs text-amber-800 font-bold mb-1">⏳ EN TRÁNSITO</div>
                      <div className="text-lg font-extrabold text-amber-700">{formatCurrency(enTransito)}</div>
                    </div>
                  )}
                </RoleGate>

                <RoleGate allowedRoles={['empleado']}>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-center">
                    <div className="text-3xl mb-2"></div>
                    <div className="text-sm text-gray-600 font-semibold">Modo Empleado</div>
                    <div className="text-xs text-gray-500 mt-1">Podés registrar ventas del mostrador. Los totales y gastos los ve el dueño.</div>
                  </div>
                </RoleGate>

                <RoleGate allowedRoles={['owner', 'super_user']}>
                  {balanceByMethod.length > 0 && (
                    <div className="border-t border-gray-200 pt-3 mt-4">
                      <div className="text-xs text-gray-500 font-semibold mb-2">Detalle por medio de pago:</div>
                      {balanceByMethod.map(({ method, income, expenses, commissions, netBalance }) => {
                        const subcat = method.subcategorias_pago
                        const cat = subcat?.categorias_pago
                        const esEfectivo = method.id === efectivoMethodId
                        return (
                          <div key={method.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{esEfectivo ? '💵 Efectivo' : `${getMedioPagoIcono(method)} ${getMedioPagoLabel(method)}`}</div>
                              {!esEfectivo && method.banco_emisor && <div className="text-xs text-gray-500">{method.banco_emisor}</div>}
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-bold ${netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(netBalance)}</div>
                              {commissions > 0 && <div className="text-xs text-gray-500">Com: {formatCurrency(commissions)}</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </RoleGate>
              </div>
            </div>

            {/* Acreditaciones del día */}
            <RoleGate allowedRoles={['owner', 'super_user']}>
              {acreditacionesHoy.length > 0 && (
                <div className="bg-purple-50 p-4 rounded-xl border-2 border-purple-600 mb-4">
                  <h2 className="m-0 mb-3 text-base text-purple-800 font-bold">📥 Acreditaciones de hoy ({acreditacionesHoy.length})</h2>
                  <div className="flex flex-col gap-2">
                    {acreditacionesHoy.map(acc => {
                      const method = acc.method
                      const icono = getMedioPagoIcono(method)
                      const label = getMedioPagoLabel(method)
                      const fechaTransaccion = new Date(acc.creado_en)
                      
                      return (
                        <div key={acc.id} className="bg-white rounded-lg border border-purple-200 p-3">
                          <div className="flex items-start gap-3">
                            <div className="text-3xl">{icono}</div>
                            <div className="flex-1">
                              <div className="text-xs text-purple-600 font-bold mb-1">📥 ACREDITACIÓN</div>
                              <div className="text-lg font-extrabold text-purple-700">{formatCurrency(acc.net)}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                {label} - {fechaTransaccion.toLocaleDateString('es-AR')} {fechaTransaccion.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}
                              </div>
                              {acc.descripcion && (
                                <div className="text-xs text-gray-500 mt-1">{acc.descripcion}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </RoleGate>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <RoleGate allowedRoles={['owner', 'cajero', 'empleado']}>
                <button onClick={() => handleOpenForm('INCOME')} className="w-full p-4 bg-green-200 text-green-900 border-none rounded-lg text-sm font-bold cursor-pointer flex flex-col items-center gap-1 hover:bg-green-300">
                  <span className="text-2xl">💰</span> REGISTRAR VENTA
                </button>
              </RoleGate>
              <RoleGate allowedRoles={['owner', 'cajero']}>
                <button onClick={() => handleOpenForm('EXPENSE')} className="w-full p-4 bg-red-200 text-red-900 border-none rounded-lg text-sm font-bold cursor-pointer flex flex-col items-center gap-1 hover:bg-red-300">
                  <span className="text-2xl">💸</span> REGISTRAR GASTO / PAGO
                </button>
              </RoleGate>
            </div>

            <RoleGate allowedRoles={['owner', 'cajero']}>
              {!isViewingHistory && (
                <button onClick={() => setShowCloseShift(true)} className="w-full p-3 bg-gray-100 text-gray-500 border border-gray-300 rounded-lg text-sm font-semibold cursor-pointer mb-4 hover:bg-gray-200">Cerrar Caja</button>
              )}
            </RoleGate>

            <h3 className="text-sm font-bold text-slate-700 mb-3">
              Movimientos del Turno {isViewingHistory && `(${new Date(selectedDate).toLocaleDateString('es-AR')})`}
            </h3>
            {movements.length === 0 ? (
              <div className="text-center p-8 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300 text-sm mb-6">Sin movimientos en este turno</div>
            ) : (
              <div className="flex flex-col gap-2 mb-6">
                {movements.map(m => {
                  const isIncome = m.tipo === 'COBRO_RECIBIDO'
                  const method = paymentMethods.find(pm => pm.id === m.medio_pago_id)
                  const subcat = method?.subcategorias_pago
                  const cat = subcat?.categorias_pago
                  const commission = m.comision_monto || 0
                  const net = m.monto - commission
                  const esEfectivo = method?.id === efectivoMethodId
                  return (
                    <div key={m.id} className="bg-white p-3 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${isIncome ? 'bg-green-100' : 'bg-red-100'}`}>
                            {isIncome ? getMedioPagoIcono(method) : '💸'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">{m.descripcion}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(m.creado_en).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})} - {esEfectivo ? '💵 Efectivo' : `${getMedioPagoIcono(method)} ${getMedioPagoLabel(method)}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold text-sm ${isIncome ? 'text-green-700' : 'text-red-700'}`}>
                            {isIncome ? '+' : '-'}{formatCurrency(m.monto)}
                          </div>
                        </div>
                      </div>
                      {isIncome && !esEfectivo && commission > 0 && (
                        <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200 text-xs">
                          <div className="text-gray-500">Comisión:</div>
                          <div className="text-red-600 font-semibold">-{formatCurrency(commission)}</div>
                        </div>
                      )}
                      {isIncome && !esEfectivo && (
                        <div className="flex justify-between items-center pt-1 text-xs">
                          <div className="text-green-700 font-semibold">Neto:</div>
                          <div className="text-green-700 font-bold">{formatCurrency(net)}</div>
                        </div>
                      )}
                      {isIncome && !esEfectivo && m.fecha_acreditacion_estimada && (
                        <div className="flex justify-between items-center pt-1 text-xs">
                          <div className="text-blue-700 font-semibold">Se acredita:</div>
                          <div className="text-blue-700 font-bold">{new Date(m.fecha_acreditacion_estimada).toLocaleDateString('es-AR')}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {showOpenShift && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="m-0 text-xl font-bold text-gray-900">Abrir Caja</h2>
              <button onClick={() => { toast.success('Apertura cancelada'); setShowOpenShift(false); }} className="bg-none border-none text-xl cursor-pointer text-gray-500"></button>
            </div>
            <form onSubmit={handleOpenShift}>
              <div className="mb-4">
                <label className="block mb-2 font-semibold text-gray-700 text-sm">Monto inicial en caja</label>
                {lastShiftBalance > 0 && <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3 text-sm text-blue-800">El último cierre fue de <strong>{formatCurrency(lastShiftBalance)}</strong>.</div>}
                <input type="number" step="0.01" min="0" value={openingAmount} onChange={handleOpeningAmountChange} placeholder="0.00" required autoFocus className={`w-full p-3 text-2xl font-bold border-2 rounded-lg box-border text-right ${isAmountModified ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white'}`} />
                {isAmountModified && (
                  <div className="mt-4">
                    <label className="block mb-2 font-bold text-amber-700 text-sm">Motivo de la diferencia (Obligatorio)</label>
                    <textarea value={differenceReason} onChange={(e) => setDifferenceReason(e.target.value)} placeholder="Ej: Saqué $2000 para pagar el flete" required rows="3" className="w-full p-3 text-base border-2 border-amber-500 rounded-lg box-border resize-vertical" />
                  </div>
                )}
              </div>
              <button type="submit" disabled={creating} className="w-full p-4 bg-blue-500 text-white border-none rounded-lg text-base font-bold cursor-pointer disabled:opacity-50 hover:bg-blue-600">{creating ? 'Abriendo...' : 'Confirmar Apertura'}</button>
            </form>
          </div>
        </div>
      )}

      {showCloseShift && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="m-0 text-xl font-bold text-gray-900">Cerrar Caja</h2>
              <button onClick={() => { toast.success('Cierre cancelado'); setShowCloseShift(false); }} className="bg-none border-none text-xl cursor-pointer text-gray-500"></button>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="text-sm text-gray-500 mb-2"><strong>Resumen del turno:</strong></div>
              <div className="flex justify-between mb-2"><span className="text-sm">Efectivo en caja:</span><span className="font-semibold text-green-700">{formatCurrency(efectivoEnCaja)}</span></div>
              <div className="flex justify-between mb-2"><span className="text-sm">Transferencias inmediatas:</span><span className="font-semibold text-blue-700">{formatCurrency(transferenciasInmediatas)}</span></div>
              <div className="flex justify-between mb-2"><span className="text-sm">Acreditaciones del día:</span><span className="font-semibold text-purple-700">{formatCurrency(totalAcreditacionesHoy)}</span></div>
              <div className="border-t border-gray-200 pt-2 flex justify-between"><span className="text-sm font-bold">Total disponible:</span><span className="font-bold text-lg text-emerald-700">{formatCurrency(totalDisponibleHoy)}</span></div>
            </div>
            <button onClick={handleCloseShift} disabled={creating} className="w-full p-4 bg-red-600 text-white border-none rounded-lg text-base font-bold cursor-pointer disabled:opacity-50 hover:bg-red-700">{creating ? 'Cerrando...' : 'Confirmar Cierre'}</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="m-0 text-xl font-bold" style={{ color: formType === 'INCOME' ? '#15803d' : '#b91c1c' }}>{formType === 'INCOME' ? '💰 Registrar Venta' : '💸 Registrar Gasto / Pago'}</h2>
              <button onClick={() => { toast.success('Operación cancelada'); setShowForm(false); }} className="bg-none border-none text-xl cursor-pointer text-gray-500">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block mb-2 font-semibold text-gray-700 text-sm">¿Cuánto?</label>
                <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required autoFocus className="w-full p-3 text-2xl font-bold border-2 border-gray-200 rounded-lg box-border text-right" />
              </div>
              <div className="mb-4">
                <label className="block mb-2 font-semibold text-gray-700 text-sm">Concepto (opcional)</label>
                {!showCustomConcept ? (
                  <>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {conceptosList.map(concepto => (
                        <button key={concepto} type="button" onClick={() => setSelectedConcept(concepto)} className={`px-3 py-2 rounded-md text-xs cursor-pointer ${selectedConcept === concepto ? (formType === 'INCOME' ? 'bg-green-100 border-2 border-green-600 font-bold' : 'bg-red-100 border-2 border-red-600 font-bold') : 'bg-gray-100 border border-gray-200 font-medium'} text-gray-900`}>{concepto}</button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setShowCustomConcept(true)} className="text-xs text-blue-500 bg-none border-none cursor-pointer p-0">+ Escribir otro concepto</button>
                  </>
                ) : (
                  <>
                    <input type="text" value={customConcept} onChange={e => setCustomConcept(e.target.value)} placeholder="Escribí el concepto..." className="w-full p-3 text-base border-2 border-gray-200 rounded-lg box-border" />
                    <button type="button" onClick={() => { setShowCustomConcept(false); setCustomConcept('') }} className="text-xs text-blue-500 bg-none border-none cursor-pointer pt-2">← Volver a la lista</button>
                  </>
                )}
              </div>
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="font-semibold text-gray-700 text-sm">Medio de pago *</label>
                  {!showQuickAddMethod && paymentMethods.length > 0 && (
                    <RoleGate allowedRoles={['owner']}>
                      <button type="button" onClick={() => setShowQuickAddMethod(true)} className="text-xs text-blue-500 bg-none border-none cursor-pointer font-semibold">+ Nuevo</button>
                    </RoleGate>
                  )}
                </div>
                {!showQuickAddMethod ? (
                  paymentMethods.length === 0 ? (
                    <div className="p-4 bg-amber-100 rounded-md text-amber-900 text-sm text-center">
                      <div className="mb-2">No hay medios de pago configurados</div>
                      <RoleGate allowedRoles={['owner']}>
                        <button type="button" onClick={() => setShowQuickAddMethod(true)} className="text-amber-900 font-bold underline bg-none border-none cursor-pointer">+ Crear medio de pago</button>
                      </RoleGate>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {paymentMethods.map(method => {
                        const subcat = method.subcategorias_pago
                        const cat = subcat?.categorias_pago
                        const isSelected = selectedMethod === method.id
                        const esEfectivo = method.id === efectivoMethodId
                        return (
                          <button key={method.id} type="button" onClick={() => setSelectedMethod(method.id)} className={`p-4 rounded-lg cursor-pointer text-left flex flex-col gap-1 ${isSelected ? (formType === 'INCOME' ? 'border-[3px] border-green-600 bg-green-50' : 'border-[3px] border-red-600 bg-red-50') : 'border-2 border-gray-200 bg-white'}`}>
                            <div className="font-bold text-sm text-gray-900">{esEfectivo ? '💵 Efectivo' : `${getMedioPagoIcono(method)} ${getMedioPagoLabel(method)}`}</div>
                            {!esEfectivo && method.banco_emisor && <div className="text-xs text-gray-500">{method.banco_emisor}</div>}
                            {isSelected && <div className={`text-xs font-bold mt-1 ${formType === 'INCOME' ? 'text-green-700' : 'text-red-600'}`}>✓ Seleccionado</div>}
                          </button>
                        )
                      })}
                    </div>
                  )
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="m-0 mb-4 text-sm font-bold text-gray-900">Nuevo medio de pago</h4>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="block mb-1 text-xs font-semibold text-gray-500">Medio de pago *</label>
                        {!showNewCategoryQuick ? (
                          <select value={quickMethodCategory} onChange={e => { if (e.target.value === 'NEW') { setShowNewCategoryQuick(true); setQuickMethodCategory('') } else { setQuickMethodCategory(e.target.value); setQuickMethodSubcategory('') } }} className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white">
                            <option value="">Seleccionar...</option>
                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.icono} {cat.nombre}</option>)}
                            <option value="NEW">+ Nuevo medio de pago</option>
                          </select>
                        ) : (
                          <div className="flex gap-2">
                            <input type="text" value={newCategoryQuickName} onChange={e => setNewCategoryQuickName(e.target.value)} placeholder="Nombre (ej: Cripto)" className="flex-1 p-2 border border-gray-300 rounded-md text-sm" />
                            <button type="button" onClick={async () => {
                              if (!newCategoryQuickName.trim()) { toast.error('Ingresá un nombre'); return }
                              try {
                                const { data, error } = await supabase.from('categorias_pago').insert([{ nombre: newCategoryQuickName.trim(), icono: '', orden: 99, activo: true }]).select().single()
                                if (error) throw error
                                setCategories([...categories, data]); setQuickMethodCategory(data.id); setShowNewCategoryQuick(false); setNewCategoryQuickName('')
                              } catch (err) { toast.error('Error: ' + err.message) }
                            }} className="px-4 py-2 bg-emerald-500 text-white border-none rounded-md font-semibold cursor-pointer text-sm">Guardar</button>
                            <button type="button" onClick={() => { setShowNewCategoryQuick(false); setNewCategoryQuickName('') }} className="px-3 py-2 bg-red-500 text-white border-none rounded-md cursor-pointer text-sm">✕</button>
                          </div>
                        )}
                      </div>
                      {quickMethodCategory && (
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-gray-500">Operador</label>
                          {!showNewOperatorQuick ? (
                            <select value={quickMethodSubcategory} onChange={e => { if (e.target.value === 'NEW') { setShowNewOperatorQuick(true); setQuickMethodSubcategory('') } else { setQuickMethodSubcategory(e.target.value) } }} className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white">
                              <option value="">Seleccionar...</option>
                              {filteredSubcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.nombre}</option>)}
                              <option value="NEW">+ Nuevo operador</option>
                            </select>
                          ) : (
                            <div className="flex gap-2">
                              <input type="text" value={newOperatorQuickName} onChange={e => setNewOperatorQuickName(e.target.value)} placeholder="Nombre (ej: Naranja X)" className="flex-1 p-2 border border-gray-300 rounded-md text-sm" />
                              <button type="button" onClick={async () => {
                                if (!newOperatorQuickName.trim()) { toast.error('Ingresá un nombre'); return }
                                try {
                                  const { data, error } = await supabase.from('subcategorias_pago').insert([{ categoria_id: quickMethodCategory, nombre: newOperatorQuickName.trim(), activo: true }]).select().single()
                                  if (error) throw error
                                  setSubcategories([...subcategories, data]); setQuickMethodSubcategory(data.id); setShowNewOperatorQuick(false); setNewOperatorQuickName('')
                                } catch (err) { toast.error('Error: ' + err.message) }
                              }} className="px-4 py-2 bg-emerald-500 text-white border-none rounded-md font-semibold cursor-pointer text-sm">Guardar</button>
                              <button type="button" onClick={() => { setShowNewOperatorQuick(false); setNewOperatorQuickName('') }} className="px-3 py-2 bg-red-500 text-white border-none rounded-md cursor-pointer text-sm">✕</button>
                            </div>
                          )}
                        </div>
                      )}
                      {quickMethodSubcategory && (
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-gray-500">Banco Emisor</label>
                          {!showNewBancoQuick ? (
                            <select value={quickMethodBanco} onChange={e => { if (e.target.value === 'NEW') { setShowNewBancoQuick(true); setQuickMethodBanco('') } else { setQuickMethodBanco(e.target.value) } }} className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white">
                              <option value="">Seleccionar banco...</option>
                              {BANCOS_ARGENTINA.map(banco => <option key={banco} value={banco}>{banco}</option>)}
                              <option value="NEW">+ Otro banco</option>
                            </select>
                          ) : (
                            <div className="flex gap-2">
                              <input type="text" value={newBancoQuickName} onChange={e => setNewBancoQuickName(e.target.value)} placeholder="Nombre del banco" className="flex-1 p-2 border border-gray-300 rounded-md text-sm" />
                              <button type="button" onClick={() => { setQuickMethodBanco(newBancoQuickName); setShowNewBancoQuick(false); setNewBancoQuickName('') }} className="px-4 py-2 bg-emerald-500 text-white border-none rounded-md font-semibold cursor-pointer text-sm">Guardar</button>
                              <button type="button" onClick={() => { setShowNewBancoQuick(false); setNewBancoQuickName('') }} className="px-3 py-2 bg-red-500 text-white border-none rounded-md cursor-pointer text-sm">✕</button>
                            </div>
                          )}
                        </div>
                      )}
                      {quickMethodBanco && (
                        <>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={quickMethodHasCommission} onChange={e => setQuickMethodHasCommission(e.target.checked)} /> ¿Tiene comisión (%)?
                          </label>
                          {quickMethodHasCommission && (
                            <div>
                              <label className="block mb-1 text-xs text-gray-500">Porcentaje (%)</label>
                              <input type="number" step="0.01" min="0" max="100" value={quickMethodCommissionPct} onChange={e => setQuickMethodCommissionPct(e.target.value)} placeholder="2.5" className="w-full p-2 border border-gray-300 rounded-md text-sm" />
                            </div>
                          )}
                          <div className="mt-2">
                            <label className="block mb-1 text-xs font-semibold text-gray-500">Se acredita en</label>
                            <div className="flex items-center gap-2">
                              <input type="number" min="0" max="60" value={quickMethodDiasAcreditacion} onChange={e => setQuickMethodDiasAcreditacion(e.target.value)} className="w-20 p-2 border border-gray-300 rounded-md text-sm text-center" />
                              <span className="text-xs text-gray-500">días</span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button type="button" onClick={() => { setShowQuickAddMethod(false); setQuickMethodCategory(''); setQuickMethodSubcategory(''); setQuickMethodBanco(''); setQuickMethodHasCommission(false); setQuickMethodCommissionPct(''); setQuickMethodDiasAcreditacion('0'); setShowNewCategoryQuick(false); setShowNewOperatorQuick(false); setShowNewBancoQuick(false); setNewCategoryQuickName(''); setNewOperatorQuickName(''); setNewBancoQuickName('') }} className="flex-1 p-2 bg-gray-100 border border-gray-300 rounded-md text-sm cursor-pointer">Cancelar</button>
                            <button type="button" onClick={async () => {
                              if (!quickMethodCategory || !quickMethodSubcategory) { toast.error('Completá medio y operador'); return }
                              try {
                                setCreating(true)
                                const comisionType = quickMethodHasCommission ? 'PORCENTAJE' : 'NINGUNA'
                                const comisionValue = quickMethodHasCommission ? (parseFloat(quickMethodCommissionPct) || 0) : 0
                                const categoryName = categories.find(c => c.id === quickMethodCategory)?.nombre || ''
                                const operatorName = subcategories.find(s => s.id === quickMethodSubcategory)?.nombre || ''
                                const generatedName = `${categoryName} - ${operatorName}${quickMethodBanco ? ' (' + quickMethodBanco + ')' : ''}`
                                const { data: newMethod, error: methodErr } = await supabase.from('medios_pago').insert([{
                                  local_id: activeLocalId, nombre: generatedName, subcategoria_id: quickMethodSubcategory,
                                  banco_emisor: quickMethodBanco || null, tipo_comision: comisionType, valor_comision: comisionValue,
                                  monto_fijo_comision: 0, dias_acreditacion: parseInt(quickMethodDiasAcreditacion) || 0, activo: true
                                }]).select(`*, subcategorias_pago(id, nombre, categorias_pago(id, nombre, icono))`).single()
                                if (methodErr) throw methodErr
                                setPaymentMethods([...paymentMethods, newMethod]); setSelectedMethod(newMethod.id); setShowQuickAddMethod(false)
                                setQuickMethodCategory(''); setQuickMethodSubcategory(''); setQuickMethodBanco(''); setQuickMethodHasCommission(false); setQuickMethodCommissionPct(''); setQuickMethodDiasAcreditacion('0')
                                setShowNewCategoryQuick(false); setShowNewOperatorQuick(false); setShowNewBancoQuick(false); setNewCategoryQuickName(''); setNewOperatorQuickName(''); setNewBancoQuickName('')
                              } catch (err) { toast.error('Error: ' + err.message) } finally { setCreating(false) }
                            }} className="flex-1 p-2 bg-emerald-500 text-white border-none rounded-md text-sm font-semibold cursor-pointer">Guardar y usar</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" disabled={creating || !selectedMethod} className={`w-full p-4 border-none rounded-lg text-base font-bold cursor-pointer ${formType === 'INCOME' ? 'bg-green-600' : 'bg-red-600'} text-white ${(!selectedMethod || creating) ? 'opacity-50' : ''} hover:opacity-90`}>
                {creating ? 'Guardando...' : !selectedMethod ? 'Seleccioná un medio de pago' : 'Confirmar'}
              </button>
            </form>
          </div>
        </div>
      )}

      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        localId={activeLocalId}
        userId={user?.id}
      />

      <BottomNav activeTab="caja" />
    </main>
  )
}

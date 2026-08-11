import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'
import { formatCurrency } from '../lib/format'
import toast from 'react-hot-toast'

const CONCEPTOS_INGRESO = ['Venta del día', 'Venta mostrador', 'Delivery', 'Servicios', 'Otros ingresos']
const CONCEPTOS_GASTO = ['Proveedor', 'Luz', 'Gas', 'Agua', 'Internet', 'Alquiler', 'Sueldos', 'Impuestos', 'Insumos', 'Otros gastos']

const ALICUOTAS_IVA = [
  { value: 21, label: '21% (General)' },
  { value: 10.5, label: '10.5% (Reducida)' },
  { value: 0, label: '0% (Exento / Monotributo)' }
]

const BANCOS_ARGENTINA = [
  'Galicia', 'Santander Río', 'BBVA', 'Macro', 'Nación', 'ICBC',
  'Brubank', 'Supervielle', 'HSBC', 'Citibank', 'Patagonia',
  'Provincia', 'Ciudad', 'Comafi', 'Hipotecario', 'Itaú',
  'BMA', 'Credicoop', 'Industrial', 'BICA'
]

export default function CajaDelDia() {
  const [user, setUser] = useState(null)
  const [businessName, setBusinessName] = useState('Mi Negocio')
  const [movements, setMovements] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('INCOME')
  const [activeShift, setActiveShift] = useState(null)
  const [closedShifts, setClosedShifts] = useState([])
  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  
  const [amount, setAmount] = useState('')
  const [selectedConcept, setSelectedConcept] = useState('')
  const [customConcept, setCustomConcept] = useState('')
  const [showCustomConcept, setShowCustomConcept] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState('')
  const [selectedAliquot, setSelectedAliquot] = useState(21)
  
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

  const loadData = async (userId) => {
    try {
      setLoading(true)
      const { data: localData } = await supabase.from('locales').select('nombre').eq('id', activeLocalId).single()
      if (localData) setBusinessName(localData.nombre)

      const { data: shiftData } = await supabase.from('turnos').select('*').eq('local_id', activeLocalId).eq('estado', 'ABIERTO').order('abierto_en', { ascending: false }).limit(1).single()
      setActiveShift(shiftData || null)

      if (shiftData) {
        const { data: txData } = await supabase.from('transacciones').select('*').eq('turno_id', shiftData.id).order('creado_en', { ascending: false }).limit(100)
        setMovements(txData || [])
      } else { setMovements([]) }

      const { data: closedData } = await supabase.from('turnos').select('*').eq('local_id', activeLocalId).eq('estado', 'CERRADO').order('cerrado_en', { ascending: false }).limit(10)
      setClosedShifts(closedData || [])

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
    } catch (err) { console.error('Error cargando datos:', err) } finally { setLoading(false) }
  }

  const hoy = new Date()
  const hoyStr = hoy.toISOString().split('T')[0]
  
  const balanceByMethod = paymentMethods.map(method => {
    const methodMovements = movements.filter(m => m.medio_pago_id === method.id)
    const income = methodMovements.filter(m => m.tipo === 'COBRO_RECIBIDO').reduce((sum, m) => sum + m.monto, 0)
    const commissions = methodMovements.filter(m => m.tipo === 'COBRO_RECIBIDO').reduce((sum, m) => sum + (m.comision_monto || 0), 0)
    const expenses = methodMovements.filter(m => m.tipo === 'GASTO_REGISTRADO').reduce((sum, m) => sum + m.monto, 0)
    const available = methodMovements.filter(m => m.tipo === 'COBRO_RECIBIDO' && (m.fecha_acreditacion_estimada || hoyStr) <= hoyStr).reduce((sum, m) => sum + (m.monto - (m.comision_monto || 0)), 0)
    const inTransit = methodMovements.filter(m => m.tipo === 'COBRO_RECIBIDO' && (m.fecha_acreditacion_estimada || hoyStr) > hoyStr).reduce((sum, m) => sum + (m.monto - (m.comision_monto || 0)), 0)
    return { method, income, commissions, expenses, netBalance: income - commissions - expenses, available, inTransit }
  }).filter(b => b.income > 0 || b.expenses > 0 || b.netBalance !== 0)

  const totalIncome = balanceByMethod.reduce((sum, b) => sum + b.income, 0)
  const totalCommissions = balanceByMethod.reduce((sum, b) => sum + b.commissions, 0)
  const totalExpenses = balanceByMethod.reduce((sum, b) => sum + b.expenses, 0)
  const totalAvailable = balanceByMethod.reduce((sum, b) => sum + b.available, 0)
  const totalInTransit = balanceByMethod.reduce((sum, b) => sum + b.inTransit, 0)
  const totalNet = totalIncome - totalCommissions - totalExpenses

  const totalIVACobrado = movements.filter(m => m.tipo === 'COBRO_RECIBIDO').reduce((sum, m) => sum + (m.monto_iva || 0), 0)

  const acreditacionesHoy = movements.filter(m => {
    if (m.tipo !== 'COBRO_RECIBIDO') return false
    const accreditationDate = m.fecha_acreditacion_estimada
    if (!accreditationDate) return false
    const createdDate = m.creado_en ? new Date(m.creado_en).toISOString().split('T')[0] : hoyStr
    return accreditationDate === hoyStr && createdDate < hoyStr
  }).map(m => ({ ...m, method: paymentMethods.find(pm => pm.id === m.medio_pago_id), net: m.monto - (m.comision_monto || 0) }))

  const acreditacionesAgrupadas = {}
  acreditacionesHoy.forEach(acc => {
    const key = acc.medio_pago_id || 'unknown'
    if (!acreditacionesAgrupadas[key]) {
      const methodName = acc.method ? (acc.method.banco_emisor ? `${acc.method.nombre} (${acc.method.banco_emisor})` : acc.method.nombre) : 'Medio desconocido'
      acreditacionesAgrupadas[key] = { method: acc.method, methodName, total: 0, transacciones: [] }
    }
    acreditacionesAgrupadas[key].total += acc.net
    acreditacionesAgrupadas[key].transacciones.push(acc)
  })
  const totalAcreditacionesHoy = Object.values(acreditacionesAgrupadas).reduce((sum, g) => sum + g.total, 0)

  const handleOpenForm = (type) => {
    setFormType(type)
    setAmount('')
    setSelectedConcept('')
    setCustomConcept('')
    setShowCustomConcept(false)
    setSelectedMethod('')
    setSelectedAliquot(21)
    setShowForm(true)
    setShowQuickAddMethod(false)
  }

  const handleOpeningAmountChange = (e) => {
    const newVal = e.target.value
    setOpeningAmount(newVal)
    if (lastShiftBalance > 0 && newVal !== lastShiftBalance.toFixed(2)) { setIsAmountModified(true) } 
    else { setIsAmountModified(false); setDifferenceReason('') }
  }

  const handleOpenShift = async (e) => {
    e.preventDefault()
    if (!openingAmount || parseFloat(openingAmount) < 0) {
      toast.error('Ingresá un monto válido')
      return
    }
    if (lastShiftBalance > 0 && isAmountModified && !differenceReason.trim()) {
      toast.error('⚠️ Explicá el motivo de la diferencia')
      return
    }
    try {
      setCreating(true)
      let { data: businesses } = await supabase.from('negocios').select('id').eq('local_id', activeLocalId).limit(1)
      let bizId
      if (businesses && businesses.length > 0) {
        bizId = businesses[0].id
      } else {
        const { data: newBiz, error: bizError } = await supabase.from('negocios').insert([{ local_id: activeLocalId, nombre: 'Principal', razon_social: 'Negocio Principal', cuit: '00-00000000-0' }]).select('id').single()
        if (bizError) throw bizError
        bizId = newBiz.id
      }

      let { data: branches } = await supabase.from('sucursales').select('id').eq('negocio_id', bizId).limit(1)
      let branchId
      if (branches && branches.length > 0) {
        branchId = branches[0].id
      } else {
        const { data: newBranch, error: branchError } = await supabase.from('sucursales').insert([{ negocio_id: bizId, nombre: 'Sucursal Principal', codigo: 'SUC-01' }]).select('id').single()
        if (branchError) throw branchError
        branchId = newBranch.id
      }

      let { data: cashPoints } = await supabase.from('cajas').select('id').eq('sucursal_id', branchId).limit(1)
      let cashPointId
      if (cashPoints && cashPoints.length > 0) {
        cashPointId = cashPoints[0].id
      } else {
        const { data: newCP, error: cpError } = await supabase.from('cajas').insert([{ sucursal_id: branchId, nombre: 'Caja Principal', codigo: 'CAJA-01' }]).select('id').single()
        if (cpError) throw cpError
        cashPointId = newCP.id
      }

      const { data: shift, error } = await supabase
        .from('turnos')
        .insert([{
          local_id: activeLocalId,
          negocio_id: bizId,
          sucursal_id: branchId,
          caja_id: cashPointId,
          abierto_por: user.id,
          estado: 'ABIERTO',
          monto_inicial: parseFloat(openingAmount),
          motivo_diferencia_apertura: isAmountModified ? differenceReason : null
        }])
        .select()
        .single()

      if (error) throw error
      
      toast.success('🔓 Caja abierta correctamente')
      setShowOpenShift(false)
      setOpeningAmount('')
      setDifferenceReason('')
      setIsAmountModified(false)
      loadData(user.id)
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleCloseShift = async () => {
    if (!activeShift) return
    try {
      setCreating(true)
      const { error } = await supabase.from('turnos').update({ estado: 'CERRADO', cerrado_en: new Date().toISOString(), cerrado_por: user.id }).eq('id', activeShift.id)
      if (error) throw error
      
      toast.success('🔒 Caja cerrada correctamente')
      setShowCloseShift(false)
      setActiveShift(null)
      setMovements([])
      loadData(user.id)
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || amount <= 0) {
      toast.error('Ingresá un monto válido')
      return
    }
    if (!selectedMethod) {
      toast.error('Seleccioná un medio de pago')
      return
    }
    if (!activeShift) {
      toast.error('Primero abrí la caja')
      return
    }

    try {
      setCreating(true)
      const method = paymentMethods.find(m => m.id === selectedMethod)
      const isIncome = formType === 'INCOME'
      const tipo = isIncome ? 'COBRO_RECIBIDO' : 'GASTO_REGISTRADO'
      
      const commission = isIncome && method.tipo_comision === 'PORCENTAJE' ? (parseFloat(amount) * (method.valor_comision || 0)) / 100 : 0
      const finalConcept = showCustomConcept ? customConcept : selectedConcept

      let montoNeto = parseFloat(amount)
      let montoIva = 0
      if (isIncome && selectedAliquot > 0) {
        montoNeto = parseFloat(amount) / (1 + (selectedAliquot / 100))
        montoIva = parseFloat(amount) - montoNeto
      }

      const diasAcreditacion = method.dias_acreditacion || 0
      const fechaAcreditacion = new Date()
      fechaAcreditacion.setDate(fechaAcreditacion.getDate() + diasAcreditacion)
      const fechaAcreditacionStr = fechaAcreditacion.toISOString().split('T')[0]

      const { error } = await supabase.from('transacciones').insert([{
        turno_id: activeShift.id,
        local_id: activeLocalId,
        negocio_id: activeShift.negocio_id,
        sucursal_id: activeShift.sucursal_id,
        caja_id: activeShift.caja_id,
        tipo,
        monto: parseFloat(amount),
        comision_monto: commission,
        medio_pago_id: method.id,
        estado_pago: 'ACREDITADO',
        descripcion: finalConcept || (isIncome ? 'Cobro' : 'Gasto'),
        categoria: finalConcept || (isIncome ? 'Ventas' : 'Gastos'),
        creado_por: user.id,
        fecha_acreditacion_estimada: isIncome ? fechaAcreditacionStr : hoyStr,
        alicuota_iva: isIncome ? selectedAliquot : 0,
        monto_iva: isIncome ? montoIva : 0,
        monto_neto: isIncome ? montoNeto : parseFloat(amount)
      }])

      if (error) throw error
      toast.success(`${isIncome ? '💰 Cobro' : ' Gasto'} registrado correctamente`)
      setShowForm(false)
      loadData(user.id)
    } catch (err) { 
      toast.error('Error: ' + err.message)
    } finally { 
      setCreating(false)
    }
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', fontSize: '14px' }}>Cargando...</div>

  const conceptosList = formType === 'INCOME' ? CONCEPTOS_INGRESO : CONCEPTOS_GASTO
  const filteredSubcategories = subcategories.filter(s => s.categoria_id === quickMethodCategory)

  return (
    <main style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '70px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '1rem', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a', fontWeight: '700' }}>{businessName}</h1>
            <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
              {activeShift ? `Turno activo • ${new Date().toLocaleDateString('es-AR')}` : 'Caja cerrada'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={() => router.push('/reportes')} style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}>Reportes</button>
            <button onClick={handleSignOut} style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}>Salir</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        {!activeShift ? (
          <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'white', borderRadius: '10px', border: '2px dashed #cbd5e1', marginBottom: '1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1rem' }}>Caja Cerrada</h3>
            <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.875rem' }}>Abrí la caja para empezar a operar</p>
            <button 
              onClick={() => setShowOpenShift(true)}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '700', cursor: 'pointer' }}
            >
              Abrir Caja
            </button>
          </div>
        ) : (
          <>
            {/* RESUMEN CONTABLE */}
            <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: '700' }}> Resumen del Turno</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ backgroundColor: '#f0fdf4', padding: '0.75rem', borderRadius: '8px', border: '2px solid #16a34a' }}>
                  <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: '700', marginBottom: '0.25rem' }}>✅ DISPONIBLE HOY</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#15803d' }}>{formatCurrency(totalAvailable)}</div>
                  {totalAcreditacionesHoy > 0 && (
                    <div style={{ fontSize: '0.65rem', color: '#16a34a', marginTop: '0.25rem' }}>
                      (+{formatCurrency(totalAcreditacionesHoy)} acreditan hoy)
                    </div>
                  )}
                </div>
                <div style={{ backgroundColor: '#fffbeb', padding: '0.75rem', borderRadius: '8px', border: '2px solid #d97706' }}>
                  <div style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: '700', marginBottom: '0.25rem' }}>⏳ EN TRÁNSITO</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#d97706' }}>{formatCurrency(totalInTransit)}</div>
                </div>
              </div>

              {totalIVACobrado > 0 && (
                <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: '700' }}>🏛️ IVA RECAUDADO (Débito Fiscal)</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '800', color: '#1d4ed8' }}>{formatCurrency(totalIVACobrado)}</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Listo para declaración jurada</div>
                </div>
              )}

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Total Cobrado:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#15803d' }}>{formatCurrency(totalIncome)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Comisiones:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#dc2626' }}>-{formatCurrency(totalCommissions)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Gastos:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#dc2626' }}>-{formatCurrency(totalExpenses)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '2px solid #0f172a' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#0f172a' }}>SALDO NETO:</span>
                  <span style={{ fontSize: '1rem', fontWeight: '800', color: totalNet >= 0 ? '#15803d' : '#b91c1c' }}>{formatCurrency(totalNet)}</span>
                </div>
              </div>

              {balanceByMethod.length > 0 && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem' }}>Desglose por medio de pago:</div>
                  {balanceByMethod.map(({ method, income, commissions, expenses, netBalance, inTransit }) => {
                    const subcat = method.subcategorias_pago
                    const cat = subcat?.categorias_pago
                    return (
                      <div key={method.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0f172a' }}>
                            {cat?.icono || ''} {method.nombre || subcat?.nombre}
                          </div>
                          {method.banco_emisor && (
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{method.banco_emisor}</div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: '700', color: netBalance >= 0 ? '#15803d' : '#b91c1c' }}>
                            {formatCurrency(netBalance)}
                          </div>
                          {inTransit > 0 && (
                            <div style={{ fontSize: '0.65rem', color: '#d97706' }}>
                              ({formatCurrency(inTransit)} en tránsito)
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ACREDITACIONES DEL DÍA */}
            {Object.keys(acreditacionesAgrupadas).length > 0 && (
              <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '10px', border: '2px solid #16a34a', marginBottom: '1rem' }}>
                <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#166534', fontWeight: '700' }}>
                  📥 Acreditaciones de hoy
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.entries(acreditacionesAgrupadas).map(([methodId, group]) => {
                    const isExpanded = expandedAccreditation === methodId
                    return (
                      <div key={methodId} style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #bbf7d0', overflow: 'hidden' }}>
                        <div 
                          onClick={() => setExpandedAccreditation(isExpanded ? null : methodId)}
                          style={{ 
                            padding: '0.75rem', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center' 
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '0.875rem', color: '#0f172a' }}>
                              {group.methodName}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              {group.transacciones.length} venta{group.transacciones.length > 1 ? 's' : ''} anterior{group.transacciones.length > 1 ? 'es' : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1rem', fontWeight: '800', color: '#15803d' }}>
                              {formatCurrency(group.total)}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                              {isExpanded ? '▼ Ocultar' : '▶ Ver detalle'}
                            </div>
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{ padding: '0.75rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#fafafa' }}>
                            {group.transacciones.map(t => {
                              const createdDate = new Date(t.creado_en)
                              return (
                                <div key={t.id} style={{ 
                                  padding: '0.5rem', 
                                  marginBottom: '0.5rem', 
                                  backgroundColor: 'white', 
                                  borderRadius: '6px', 
                                  border: '1px solid #e2e8f0',
                                  fontSize: '0.75rem'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                    <span style={{ color: '#64748b' }}>
                                       {createdDate.toLocaleDateString('es-AR')} {createdDate.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                    <span style={{ fontWeight: '700', color: '#15803d' }}>
                                      {formatCurrency(t.net)}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                                    <span style={{ color: '#64748b' }}>
                                      {t.descripcion} • {formatCurrency(t.monto)} bruto
                                    </span>
                                    {t.comision_monto > 0 && (
                                      <span style={{ color: '#dc2626' }}>
                                        -{formatCurrency(t.comision_monto)} comisión
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <button onClick={() => handleOpenForm('INCOME')} style={{ padding: '1rem', backgroundColor: '#86efac', color: '#14532d', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '700', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '1.5rem' }}>💰</span> COBRO
              </button>
              <button onClick={() => handleOpenForm('EXPENSE')} style={{ padding: '1rem', backgroundColor: '#fca5a5', color: '#7f1d1d', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '700', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '1.5rem' }}>💸</span> GASTO
              </button>
            </div>

            <button onClick={() => setShowCloseShift(true)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', marginBottom: '1rem' }}>
              Cerrar Caja
            </button>
          </>
        )}

        {activeShift && (
          <>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#334155', marginBottom: '0.75rem' }}>Movimientos del Turno</h3>
            {movements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', backgroundColor: 'white', borderRadius: '8px', border: '1px dashed #cbd5e1', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Sin movimientos en este turno</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {movements.map(m => {
                  const isIncome = m.tipo === 'COBRO_RECIBIDO'
                  const method = paymentMethods.find(pm => pm.id === m.medio_pago_id)
                  const subcat = method?.subcategorias_pago
                  const cat = subcat?.categorias_pago
                  const commission = m.comision_monto || 0
                  const net = m.monto - commission
                  const accreditationDate = m.fecha_acreditacion_estimada || hoyStr
                  const isInTransit = isIncome && accreditationDate > hoyStr
                  
                  return (
                    <div key={m.id} style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: isIncome ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                            {isIncome ? '' : '📤'}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.875rem' }}>{m.descripcion}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {new Date(m.creado_en).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})} • {cat?.icono || ''} {subcat?.nombre || 'Efectivo'}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '700', fontSize: '0.875rem', color: isIncome ? '#15803d' : '#b91c1c' }}>
                            {isIncome ? '+' : '-'}{formatCurrency(m.monto)}
                          </div>
                        </div>
                      </div>
                      {isIncome ? (
                        <>
                          {commission > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px dashed #e2e8f0', fontSize: '0.75rem' }}>
                              <div style={{ color: '#64748b' }}>Comisión:</div>
                              <div style={{ color: '#dc2626', fontWeight: '600' }}>-{formatCurrency(commission)}</div>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.25rem', fontSize: '0.75rem' }}>
                            <div style={{ color: '#059669', fontWeight: '600' }}>Neto:</div>
                            <div style={{ color: '#059669', fontWeight: '700' }}>{formatCurrency(net)}</div>
                          </div>
                          {isInTransit && (
                            <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#fffbeb', borderRadius: '6px', border: '1px solid #fcd34d' }}>
                              <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: '600' }}>
                                ⏳ Se acredita el: {new Date(accreditationDate + 'T12:00:00').toLocaleDateString('es-AR')}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.25rem', fontSize: '0.75rem' }}>
                          <div style={{ color: '#b91c1c', fontWeight: '600' }}>Gasto:</div>
                          <div style={{ color: '#b91c1c', fontWeight: '700' }}>-{formatCurrency(m.monto)}</div>
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

      {/* MODAL APERTURA DE CAJA */}
      {showOpenShift && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}> Abrir Caja</h2>
              <button onClick={() => { toast.success('Apertura cancelada'); setShowOpenShift(false); }} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <form onSubmit={handleOpenShift}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Monto inicial en caja</label>
                {lastShiftBalance > 0 && (
                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.875rem', color: '#1e40af' }}>
                    💡 <strong>Sugerencia:</strong> El último cierre fue de <strong>{formatCurrency(lastShiftBalance)}</strong>.
                  </div>
                )}
                <input 
                  type="number" step="0.01" min="0" value={openingAmount} onChange={handleOpeningAmountChange} 
                  placeholder="0.00" required autoFocus
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1.5rem', fontWeight: '700', border: isAmountModified ? '2px solid #f59e0b' : '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box', textAlign: 'right', backgroundColor: isAmountModified ? '#fffbeb' : 'white' }}
                />
                {isAmountModified && (
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#b45309', fontSize: '0.875rem' }}>⚠️ Motivo de la diferencia (Obligatorio)</label>
                    <textarea 
                      value={differenceReason} onChange={(e) => setDifferenceReason(e.target.value)}
                      placeholder="Ej: Saqué $2000 para pagar el flete, faltante de caja, etc."
                      required rows="3"
                      style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', border: '2px solid #f59e0b', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                )}
              </div>
              <button type="submit" disabled={creating} style={{ width: '100%', padding: '1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}>
                {creating ? 'Abriendo...' : 'Confirmar Apertura'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CIERRE DE CAJA */}
      {showCloseShift && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}> Cerrar Caja</h2>
              <button onClick={() => { toast.success('Cierre cancelado'); setShowCloseShift(false); }} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                <strong>Resumen del turno:</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem' }}>Disponible hoy:</span>
                <span style={{ fontWeight: '600', color: '#15803d' }}>{formatCurrency(totalAvailable)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem' }}>En tránsito:</span>
                <span style={{ fontWeight: '600', color: '#d97706' }}>{formatCurrency(totalInTransit)}</span>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '700' }}>Saldo neto:</span>
                <span style={{ fontWeight: '700', fontSize: '1.125rem' }}>{formatCurrency(totalNet)}</span>
              </div>
            </div>
            <button onClick={handleCloseShift} disabled={creating} style={{ width: '100%', padding: '1rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}>
              {creating ? 'Cerrando...' : 'Confirmar Cierre'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL COBRO/GASTO */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: formType === 'INCOME' ? '#15803d' : '#b91c1c' }}>
                {formType === 'INCOME' ? '💰 Cobro' : '💸 Gasto'}
              </h2>
              <button onClick={() => { toast.success('Operación cancelada'); setShowForm(false); }} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>¿Cuánto?</label>
                <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required autoFocus style={{ width: '100%', padding: '0.75rem', fontSize: '1.5rem', fontWeight: '700', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box', textAlign: 'right' }} />
              </div>

              {formType === 'INCOME' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Alicuota de IVA</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {ALICUOTAS_IVA.map(alic => (
                      <button
                        key={alic.value}
                        type="button"
                        onClick={() => setSelectedAliquot(alic.value)}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          border: selectedAliquot === alic.value ? '2px solid #16a34a' : '1px solid #e2e8f0',
                          borderRadius: '6px',
                          backgroundColor: selectedAliquot === alic.value ? '#f0fdf4' : 'white',
                          fontWeight: selectedAliquot === alic.value ? '700' : '500',
                          fontSize: '0.875rem',
                          cursor: 'pointer'
                        }}
                      >
                        {alic.label}
                      </button>
                    ))}
                  </div>
                  {amount > 0 && selectedAliquot > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b', backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '6px' }}>
                      Desglose: Neto {formatCurrency(parseFloat(amount) / (1 + (selectedAliquot/100)))} + IVA {formatCurrency(parseFloat(amount) - (parseFloat(amount) / (1 + (selectedAliquot/100))))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Concepto (opcional)</label>
                {!showCustomConcept ? (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {conceptosList.map(concepto => (
                        <button key={concepto} type="button" onClick={() => setSelectedConcept(concepto)} style={{ padding: '0.5rem 0.75rem', backgroundColor: selectedConcept === concepto ? (formType === 'INCOME' ? '#dcfce7' : '#fee2e2') : '#f1f5f9', border: selectedConcept === concepto ? `2px solid ${formType === 'INCOME' ? '#16a34a' : '#dc2626'}` : '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.75rem', fontWeight: selectedConcept === concepto ? '700' : '500', color: '#0f172a', cursor: 'pointer' }}>{concepto}</button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setShowCustomConcept(true)} style={{ fontSize: '0.75rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}>+ Escribir otro concepto</button>
                  </>
                ) : (
                  <>
                    <input type="text" value={customConcept} onChange={e => setCustomConcept(e.target.value)} placeholder="Escribí el concepto..." style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }} />
                    <button type="button" onClick={() => { setShowCustomConcept(false); setCustomConcept('') }} style={{ fontSize: '0.75rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0 0 0' }}>← Volver a la lista</button>
                  </>
                )}
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Medio de pago *</label>
                  {!showQuickAddMethod && paymentMethods.length > 0 && (
                    <button 
                      type="button"
                      onClick={() => setShowQuickAddMethod(true)}
                      style={{ fontSize: '0.75rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                    >
                      + Nuevo
                    </button>
                  )}
                </div>

                {!showQuickAddMethod ? (
                  paymentMethods.length === 0 ? (
                    <div style={{ padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '6px', color: '#92400e', fontSize: '0.875rem', textAlign: 'center' }}>
                      <div style={{ marginBottom: '0.5rem' }}>No hay medios de pago configurados</div>
                      <button type="button" onClick={() => setShowQuickAddMethod(true)} style={{ color: '#92400e', fontWeight: 'bold', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>+ Crear medio de pago</button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {paymentMethods.map(method => {
                        const subcat = method.subcategorias_pago
                        const cat = subcat?.categorias_pago
                        const isSelected = selectedMethod === method.id
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setSelectedMethod(method.id)}
                            style={{
                              padding: '1rem',
                              border: isSelected ? `3px solid ${formType === 'INCOME' ? '#16a34a' : '#dc2626'}` : '2px solid #e2e8f0',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? (formType === 'INCOME' ? '#f0fdf4' : '#fef2f2') : 'white',
                              textAlign: 'left',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem'
                            }}
                          >
                            <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0f172a' }}>
                              {cat?.icono || ''} {method.nombre || subcat?.nombre || 'Medio'}
                            </div>
                            {method.banco_emisor && (
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{method.banco_emisor}</div>
                            )}
                            {isSelected && (
                              <div style={{ fontSize: '0.7rem', color: formType === 'INCOME' ? '#16a34a' : '#dc2626', fontWeight: '700', marginTop: '0.25rem' }}>
                                ✓ Seleccionado
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                ) : (
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: '700', color: '#0f172a' }}>Nuevo medio de pago</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Medio de pago *</label>
                        {!showNewCategoryQuick ? (
                          <select 
                            value={quickMethodCategory} 
                            onChange={e => {
                              if (e.target.value === 'NEW') {
                                setShowNewCategoryQuick(true)
                                setQuickMethodCategory('')
                              } else {
                                setQuickMethodCategory(e.target.value)
                                setQuickMethodSubcategory('')
                              }
                            }}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', backgroundColor: 'white' }}
                          >
                            <option value="">Seleccionar...</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.icono} {cat.nombre}</option>
                            ))}
                            <option value="NEW">+ Nuevo medio de pago</option>
                          </select>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input 
                              type="text"
                              value={newCategoryQuickName}
                              onChange={e => setNewCategoryQuickName(e.target.value)}
                              placeholder="Nombre (ej: Cripto)"
                              style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                            />
                            <button 
                              type="button"
                              onClick={async () => {
                                if (!newCategoryQuickName.trim()) {
                                  toast.error('Ingresá un nombre')
                                  return
                                }
                                try {
                                  const { data, error } = await supabase.from('categorias_pago').insert([{ 
                                    nombre: newCategoryQuickName.trim(), 
                                    icono: '💳',
                                    orden: 99,
                                    activo: true
                                  }]).select().single()
                                  if (error) throw error
                                  setCategories([...categories, data])
                                  setQuickMethodCategory(data.id)
                                  setShowNewCategoryQuick(false)
                                  setNewCategoryQuickName('')
                                } catch (err) {
                                  toast.error('Error: ' + err.message)
                                }
                              }}
                              style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                            >
                              Guardar
                            </button>
                            <button 
                              type="button"
                              onClick={() => { setShowNewCategoryQuick(false); setNewCategoryQuickName(''); }}
                              style={{ padding: '0.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>

                      {quickMethodCategory && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Operador</label>
                          {!showNewOperatorQuick ? (
                            <select 
                              value={quickMethodSubcategory} 
                              onChange={e => {
                                if (e.target.value === 'NEW') {
                                  setShowNewOperatorQuick(true)
                                  setQuickMethodSubcategory('')
                                } else {
                                  setQuickMethodSubcategory(e.target.value)
                                }
                              }}
                              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', backgroundColor: 'white' }}
                            >
                              <option value="">Seleccionar...</option>
                              {filteredSubcategories.map(sub => (
                                <option key={sub.id} value={sub.id}>{sub.nombre}</option>
                              ))}
                              <option value="NEW">+ Nuevo operador</option>
                            </select>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input 
                                type="text"
                                value={newOperatorQuickName}
                                onChange={e => setNewOperatorQuickName(e.target.value)}
                                placeholder="Nombre (ej: Naranja X)"
                                style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                              />
                              <button 
                                type="button"
                                onClick={async () => {
                                  if (!newOperatorQuickName.trim()) {
                                    toast.error('Ingresá un nombre')
                                    return
                                  }
                                  try {
                                    const { data, error } = await supabase.from('subcategorias_pago').insert([{ 
                                      categoria_id: quickMethodCategory,
                                      nombre: newOperatorQuickName.trim(),
                                      activo: true
                                    }]).select().single()
                                    if (error) throw error
                                    setSubcategories([...subcategories, data])
                                    setQuickMethodSubcategory(data.id)
                                    setShowNewOperatorQuick(false)
                                    setNewOperatorQuickName('')
                                  } catch (err) {
                                    toast.error('Error: ' + err.message)
                                  }
                                }}
                                style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                Guardar
                              </button>
                              <button 
                                type="button"
                                onClick={() => { setShowNewOperatorQuick(false); setNewOperatorQuickName(''); }}
                                style={{ padding: '0.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {quickMethodSubcategory && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Banco Emisor</label>
                          {!showNewBancoQuick ? (
                            <select 
                              value={quickMethodBanco} 
                              onChange={e => {
                                if (e.target.value === 'NEW') {
                                  setShowNewBancoQuick(true)
                                  setQuickMethodBanco('')
                                } else {
                                  setQuickMethodBanco(e.target.value)
                                }
                              }}
                              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', backgroundColor: 'white' }}
                            >
                              <option value="">Seleccionar banco...</option>
                              {BANCOS_ARGENTINA.map(banco => (
                                <option key={banco} value={banco}>{banco}</option>
                              ))}
                              <option value="NEW">+ Otro banco</option>
                            </select>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input 
                                type="text"
                                value={newBancoQuickName}
                                onChange={e => setNewBancoQuickName(e.target.value)}
                                placeholder="Nombre del banco"
                                style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                              />
                              <button 
                                type="button"
                                onClick={() => {
                                  setQuickMethodBanco(newBancoQuickName)
                                  setShowNewBancoQuick(false)
                                  setNewBancoQuickName('')
                                }}
                                style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                Guardar
                              </button>
                              <button 
                                type="button"
                                onClick={() => { setShowNewBancoQuick(false); setNewBancoQuickName(''); }}
                                style={{ padding: '0.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {quickMethodBanco && (
                        <>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                            <input 
                              type="checkbox" 
                              checked={quickMethodHasCommission} 
                              onChange={e => setQuickMethodHasCommission(e.target.checked)} 
                            />
                            ¿Tiene comisión (%)?
                          </label>

                          {quickMethodHasCommission && (
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.7rem', color: '#64748b' }}>Porcentaje (%)</label>
                              <input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                max="100"
                                value={quickMethodCommissionPct} 
                                onChange={e => setQuickMethodCommissionPct(e.target.value)} 
                                placeholder="2.5"
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }} 
                              />
                            </div>
                          )}

                          <div style={{ marginTop: '0.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Se acredita en</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input 
                                type="number" 
                                min="0" 
                                max="60"
                                value={quickMethodDiasAcreditacion} 
                                onChange={e => setQuickMethodDiasAcreditacion(e.target.value)} 
                                style={{ width: '80px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', textAlign: 'center' }} 
                              />
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>días</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                            <button 
                              type="button" 
                              onClick={() => { 
                                setShowQuickAddMethod(false)
                                setQuickMethodCategory('')
                                setQuickMethodSubcategory('')
                                setQuickMethodBanco('')
                                setQuickMethodHasCommission(false)
                                setQuickMethodCommissionPct('')
                                setQuickMethodDiasAcreditacion('0')
                                setShowNewCategoryQuick(false)
                                setShowNewOperatorQuick(false)
                                setShowNewBancoQuick(false)
                                setNewCategoryQuickName('')
                                setNewOperatorQuickName('')
                                setNewBancoQuickName('')
                              }}
                              style={{ flex: 1, padding: '0.5rem', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', cursor: 'pointer' }}
                            >
                              Cancelar
                            </button>
                            <button 
                              type="button" 
                              onClick={async () => {
                                if (!quickMethodCategory) {
                                  toast.error('Seleccioná un medio de pago')
                                  return
                                }
                                if (!quickMethodSubcategory) {
                                  toast.error('Seleccioná un operador')
                                  return
                                }
                                try {
                                  setCreating(true)
                                  
                                  const comisionType = quickMethodHasCommission ? 'PORCENTAJE' : 'NINGUNA'
                                  const comisionValue = quickMethodHasCommission ? (parseFloat(quickMethodCommissionPct) || 0) : 0
                                  
                                  const categoryName = categories.find(c => c.id === quickMethodCategory)?.nombre || ''
                                  const operatorName = subcategories.find(s => s.id === quickMethodSubcategory)?.nombre || ''
                                  const generatedName = `${categoryName} - ${operatorName}${quickMethodBanco ? ' (' + quickMethodBanco + ')' : ''}`
                                  
                                  const { data: newMethod, error: methodErr } = await supabase.from('medios_pago').insert([{
                                    local_id: activeLocalId,
                                    nombre: generatedName,
                                    subcategoria_id: quickMethodSubcategory,
                                    banco_emisor: quickMethodBanco || null,
                                    tipo_comision: comisionType,
                                    valor_comision: comisionValue,
                                    monto_fijo_comision: 0,
                                    dias_acreditacion: parseInt(quickMethodDiasAcreditacion) || 0,
                                    activo: true
                                  }]).select(`*, subcategorias_pago(id, nombre, categorias_pago(id, nombre, icono))`).single()

                                  if (methodErr) throw methodErr

                                  setPaymentMethods([...paymentMethods, newMethod])
                                  setSelectedMethod(newMethod.id)
                                  setShowQuickAddMethod(false)
                                  
                                  setQuickMethodCategory('')
                                  setQuickMethodSubcategory('')
                                  setQuickMethodBanco('')
                                  setQuickMethodHasCommission(false)
                                  setQuickMethodCommissionPct('')
                                  setQuickMethodDiasAcreditacion('0')
                                  setShowNewCategoryQuick(false)
                                  setShowNewOperatorQuick(false)
                                  setShowNewBancoQuick(false)
                                  setNewCategoryQuickName('')
                                  setNewOperatorQuickName('')
                                  setNewBancoQuickName('')
                                } catch (err) {
                                  toast.error('Error al crear medio de pago: ' + err.message)
                                } finally {
                                  setCreating(false)
                                }
                              }}
                              style={{ flex: 1, padding: '0.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}
                            >
                              Guardar y usar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" disabled={creating || !selectedMethod} style={{ width: '100%', padding: '1rem', backgroundColor: formType === 'INCOME' ? '#16a34a' : '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', opacity: (!selectedMethod || creating) ? 0.5 : 1 }}>
                {creating ? 'Guardando...' : !selectedMethod ? 'Seleccioná un medio de pago' : 'Confirmar'}
              </button>
            </form>
          </div>
        </div>
      )}

      <BottomNav activeTab="caja" />
    </main>
  )
}
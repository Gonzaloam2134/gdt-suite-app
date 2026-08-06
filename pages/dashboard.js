import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BottomNav from '../components/BottomNav'

const CONCEPTOS_INGRESO = ['Venta del día', 'Venta mostrador', 'Delivery', 'Servicios', 'Otros ingresos']
const CONCEPTOS_GASTO = ['Proveedor', 'Luz', 'Gas', 'Agua', 'Internet', 'Alquiler', 'Sueldos', 'Impuestos', 'Insumos', 'Otros gastos']

export default function CajaDelDia() {
  const [userRole, setUserRole] = useState(null)
  const [user, setUser] = useState(null)
  const [businessName, setBusinessName] = useState('Mi Negocio')
  const [movements, setMovements] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('INCOME')
  const [activeShift, setActiveShift] = useState(null)
  const [closedShifts, setClosedShifts] = useState([])
  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [expandedShiftId, setExpandedShiftId] = useState(null)
  const [shiftMovements, setShiftMovements] = useState({})
  
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [selectedConcept, setSelectedConcept] = useState('')
  const [customConcept, setCustomConcept] = useState('')
  const [showCustomConcept, setShowCustomConcept] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState('')
  
  const [openingAmount, setOpeningAmount] = useState('')
  const [lastShiftBalance, setLastShiftBalance] = useState(0)
  const [differenceReason, setDifferenceReason] = useState('')
  const [isAmountModified, setIsAmountModified] = useState(false)
  
  const [creating, setCreating] = useState(false)
  
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
    return () => {}
  }, [router, activeLocalId])

  const loadData = async (userId) => {
    try {
      setLoading(true)
      // Cargar rol del usuario
const { data: roleData } = await supabase
  .from('roles_usuario')
  .select('rol')
  .eq('local_id', activeLocalId)
  .eq('usuario_id', userId)
  .single()

setUserRole(roleData?.rol || null)
      const { data: wsData } = await supabase.from('locales').select('nombre').eq('id', activeLocalId).single()
      if (wsData) setBusinessName(wsData.nombre)

      const { data: shiftData } = await supabase
        .from('turnos')
        .select('*')
        .eq('local_id', activeLocalId)
        .eq('estado', 'ABIERTO')
        .order('creado_en', { ascending: false })
        .limit(1)
        .single()
      
      setActiveShift(shiftData || null)

      if (shiftData) {
        const { data: txData } = await supabase
          .from('transacciones')
          .select('*')
          .eq('turno_id', shiftData.id)
          .order('creado_en', { ascending: false })
          .limit(50)
        setMovements(txData || [])
      } else {
        setMovements([])
      }

      const { data: closedData } = await supabase
        .from('turnos')
        .select('*')
        .eq('local_id', activeLocalId)
        .eq('estado', 'CERRADO')
        .order('cerrado_en', { ascending: false })
        .limit(10)
      setClosedShifts(closedData || [])

      if (closedData && closedData.length > 0) {
        const lastClosed = closedData[0]
        const { data: lastTx } = await supabase
          .from('transacciones')
          .select('monto, comision_monto, tipo')
          .eq('turno_id', lastClosed.id)
        
        let calculatedBalance = lastClosed.monto_inicial || 0
        if (lastTx) {
          lastTx.forEach(tx => {
            const isIncome = tx.tipo === 'COBRO_RECIBIDO' || tx.tipo === 'CAJA_ABIERTA'
            const commission = tx.comision_monto || 0
            if (isIncome) {
              calculatedBalance += (tx.monto - commission)
            } else {
              calculatedBalance -= tx.monto
            }
          })
        }
        setLastShiftBalance(calculatedBalance)
        setOpeningAmount(calculatedBalance.toFixed(2))
        setIsAmountModified(false)
        setDifferenceReason('')
      } else {
        setLastShiftBalance(0)
        setOpeningAmount('')
      }
      
      const { data: pmData } = await supabase
        .from('medios_pago')
        .select('*')
        .eq('local_id', activeLocalId)
        .eq('activo', true)
        .order('nombre', { ascending: true })
      setPaymentMethods(pmData || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadShiftMovements = async (shiftId) => {
    if (shiftMovements[shiftId]) return
    const { data } = await supabase.from('transacciones').select('*').eq('turno_id', shiftId).order('creado_en', { ascending: false })
    if (data) setShiftMovements(prev => ({ ...prev, [shiftId]: data }))
  }

  const toggleShiftExpand = async (shiftId) => {
    if (expandedShiftId === shiftId) {
      setExpandedShiftId(null)
    } else {
      setExpandedShiftId(shiftId)
      await loadShiftMovements(shiftId)
    }
  }

  const calculateShiftTotals = (movs) => {
    return movs.reduce((acc, curr) => {
      const isIncome = curr.tipo === 'COBRO_RECIBIDO' || curr.tipo === 'CAJA_ABIERTA'
      const commission = curr.comision_monto || 0
      if (isIncome) {
        acc.in += curr.monto
        acc.commissions += commission
        acc.net += curr.monto - commission
      } else {
        acc.out += curr.monto
      }
      return acc
    }, { in: 0, commissions: 0, net: 0, out: 0 })
  }

  const totals = movements.reduce((acc, curr) => {
    const isIncome = curr.tipo === 'COBRO_RECIBIDO' || curr.tipo === 'CAJA_ABIERTA'
    const commission = curr.comision_monto || 0
    if (isIncome) {
      acc.in += curr.monto
      acc.commissions += commission
      acc.net += curr.monto - commission
    } else {
      acc.out += curr.monto
    }
    return acc
  }, { in: 0, commissions: 0, net: 0, out: 0 })

  const currentBalance = (activeShift?.monto_inicial || 0) + totals.net - totals.out

  const handleOpenForm = (type) => {
    setFormType(type)
    setAmount('')
    setDescription('')
    setSelectedConcept('')
    setCustomConcept('')
    setShowCustomConcept(false)
    setSelectedMethod('')
    setShowForm(true)
  }

  const handleOpeningAmountChange = (e) => {
    const newVal = e.target.value
    setOpeningAmount(newVal)
    
    // Solo marcar como modificado si hay un balance anterior Y es diferente
    // Si lastShiftBalance es 0 (primera vez), no pedir justificación
    if (lastShiftBalance > 0 && newVal !== lastShiftBalance.toFixed(2)) {
      setIsAmountModified(true)
    } else {
      setIsAmountModified(false)
      setDifferenceReason('')
    }
  }

  const handleOpenShift = async (e) => {
    e.preventDefault()
    if (!openingAmount || parseFloat(openingAmount) < 0) return alert('Ingresá un monto válido')
    if (isAmountModified && !differenceReason.trim()) {
      return alert('⚠️ Como el monto es diferente al cierre anterior, debés explicar el motivo de la diferencia.')
    }

    try {
      setCreating(true)
      
      let { data: businesses } = await supabase.from('negocios').select('id').eq('local_id', activeLocalId).limit(1)
      let bizId
      if (businesses && businesses.length > 0) {
        bizId = businesses[0].id
      } else {
        const { data: newBiz, error: bizError } = await supabase.from('negocios').insert([{ 
          local_id: activeLocalId, nombre: 'Principal', razon_social: 'Negocio Principal', cuit: '00-00000000-0' 
        }]).select('id').single()
        if (bizError) throw bizError
        bizId = newBiz.id
      }

      let { data: branches } = await supabase.from('sucursales').select('id').eq('negocio_id', bizId).limit(1)
      let branchId
      if (branches && branches.length > 0) {
        branchId = branches[0].id
      } else {
        const { data: newBranch, error: branchError } = await supabase.from('sucursales').insert([{ 
          negocio_id: bizId, nombre: 'Sucursal Principal', codigo: 'SUC-01' 
        }]).select('id').single()
        if (branchError) throw branchError
        branchId = newBranch.id
      }

      let { data: cashPoints } = await supabase.from('cajas').select('id').eq('sucursal_id', branchId).limit(1)
      let cashPointId
      if (cashPoints && cashPoints.length > 0) {
        cashPointId = cashPoints[0].id
      } else {
        const { data: newCP, error: cpError } = await supabase.from('cajas').insert([{ 
          sucursal_id: branchId, nombre: 'Caja Principal', codigo: 'CAJA-01' 
        }]).select('id').single()
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
      
      setShowOpenShift(false)
      setOpeningAmount('')
      setDifferenceReason('')
      setIsAmountModified(false)
      loadData(user.id)
    } catch (err) {
      alert(`Error: ${err.message}`)
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
      
      setShowCloseShift(false)
      setActiveShift(null)
      setMovements([])
      loadData(user.id)
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || amount <= 0) return alert('Ingresá un monto válido')
    if (!selectedMethod) return alert('Seleccioná un medio de pago')
    if (!activeShift) return alert('Primero abrí la caja')

    try {
      setCreating(true)
      const method = paymentMethods.find(m => m.id === selectedMethod)
      const isIncome = formType === 'INCOME'
      const tipo = isIncome ? 'COBRO_RECIBIDO' : 'GASTO_REGISTRADO'
      const commission = isIncome ? ((parseFloat(amount) * (method.valor_comision || 0)) / 100) + (method.monto_fijo_comision || 0) : 0
      const finalConcept = showCustomConcept ? customConcept : selectedConcept

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
        creado_por: user.id
      }])

      if (error) throw error
      setShowForm(false)
      loadData(user.id)
            // --- Lógica de Invitaciones Pendientes ---
      const { data: pendingInvites } = await supabase
        .from('invitaciones')
        .select('id, local_id, rol, locales(nombre)')
        .eq('email', user.email)
        .eq('estado', 'pendiente')

      if (pendingInvites && pendingInvites.length > 0) {
        const invite = pendingInvites[0]
        const accept = window.confirm(`¡Hola! Tienes una invitación pendiente para unirte a "${invite.locales?.nombre || 'un local'}" como ${invite.rol}. ¿Deseas aceptarla?`)
        
        if (accept) {
          await supabase.from('roles_usuario').insert({
            local_id: invite.local_id,
            usuario_id: user.id,
            rol: invite.rol
          })
          await supabase.from('invitaciones').update({ estado: 'aceptada' }).eq('id', invite.id)
          
          alert('✅ ¡Te has unido al local exitosamente!')
          window.location.reload()
        }
      }
      // -----------------------------------------
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', fontSize: '14px' }}>Cargando...</div>

  const conceptosList = formType === 'INCOME' ? CONCEPTOS_INGRESO : CONCEPTOS_GASTO

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
  {userRole === 'SUPER_ADMIN' && (
    <button onClick={() => router.push('/admin')} style={{ padding: '6px 10px', backgroundColor: '#1e40af', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}> Consola</button>
  )}
  <button onClick={handleSignOut} style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}>Salir</button>
</div>
        </div>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        {!activeShift ? (
          <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'white', borderRadius: '10px', border: '2px dashed #cbd5e1', marginBottom: '1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}></div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#dbeafe', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#1e40af', fontWeight: '700', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Apertura</div>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: '#1d4ed8' }}>${(activeShift?.monto_inicial || 0).toFixed(2)}</div>
              </div>
              <div style={{ backgroundColor: '#dcfce7', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#166534', fontWeight: '700', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Bruto</div>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: '#15803d' }}>${totals.in.toFixed(2)}</div>
              </div>
              <div style={{ backgroundColor: '#fee2e2', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#991b1b', fontWeight: '700', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Comisiones</div>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: '#b91c1c' }}>-${totals.commissions.toFixed(2)}</div>
              </div>
              <div style={{ backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: '700', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Neto</div>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: '#ffffff' }}>${totals.net.toFixed(2)}</div>
              </div>
            </div>

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
            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#334155', marginBottom: '0.75rem' }}> Movimientos del Turno Actual</h3>
            {movements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', backgroundColor: 'white', borderRadius: '8px', border: '1px dashed #cbd5e1', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Sin movimientos en este turno</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {movements.map(m => {
                  const isIncome = m.tipo === 'COBRO_RECIBIDO' || m.tipo === 'CAJA_ABIERTA'
                  const method = paymentMethods.find(pm => pm.id === m.medio_pago_id)
                  const commission = m.comision_monto || 0
                  const net = m.monto - commission
                  return (
                    <div key={m.id} style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: isIncome ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{isIncome ? '📥' : '📤'}</div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.875rem' }}>{m.descripcion}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(m.creado_en).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})} • {method?.nombre || 'Efectivo'}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '700', fontSize: '0.875rem', color: isIncome ? '#15803d' : '#b91c1c' }}>{isIncome ? '+' : '-'}${m.monto.toFixed(2)}</div>
                        </div>
                      </div>
                      {isIncome && commission > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px dashed #e2e8f0', fontSize: '0.75rem' }}>
                          <div style={{ color: '#64748b' }}>Comisión ({method?.nombre}):</div>
                          <div style={{ color: '#dc2626', fontWeight: '600' }}>-${commission.toFixed(2)}</div>
                        </div>
                      )}
                      {isIncome && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.25rem', fontSize: '0.75rem' }}>
                          <div style={{ color: '#059669', fontWeight: '600' }}>Neto a caja:</div>
                          <div style={{ color: '#059669', fontWeight: '700' }}>+${net.toFixed(2)}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {closedShifts.length > 0 && (
          <>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#334155', marginBottom: '0.75rem' }}>📋 Cierres Anteriores</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {closedShifts.map(shift => {
                const shiftMovs = shiftMovements[shift.id] || []
                const shiftTotals = calculateShiftTotals(shiftMovs)
                const finalBalance = (shift.monto_inicial || 0) + shiftTotals.net - shiftTotals.out
                const isExpanded = expandedShiftId === shift.id
                
                return (
                  <div key={shift.id} style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div onClick={() => toggleShiftExpand(shift.id)} style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.875rem', color: '#0f172a' }}>{new Date(shift.cerrado_en).toLocaleDateString('es-AR')} - {new Date(shift.cerrado_en).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{shiftMovs.length} movimientos • Saldo: ${finalBalance.toFixed(2)}</div>
                      </div>
                      <div style={{ fontSize: '1.25rem', color: '#64748b' }}>{isExpanded ? '▼' : '▶'}</div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '0.75rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <div style={{ backgroundColor: '#dcfce7', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.625rem', color: '#166534', fontWeight: '700' }}>BRUTO</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: '800', color: '#15803d' }}>${shiftTotals.in.toFixed(2)}</div>
                          </div>
                          <div style={{ backgroundColor: '#fee2e2', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.625rem', color: '#991b1b', fontWeight: '700' }}>COMIS</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: '800', color: '#b91c1c' }}>-${shiftTotals.commissions.toFixed(2)}</div>
                          </div>
                          <div style={{ backgroundColor: '#0f172a', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: '700' }}>NETO</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: '800', color: '#ffffff' }}>${shiftTotals.net.toFixed(2)}</div>
                          </div>
                        </div>
                        {shiftMovs.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>Cargando movimientos...</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {shiftMovs.map(m => {
                              const isIncome = m.tipo === 'COBRO_RECIBIDO' || m.tipo === 'CAJA_ABIERTA'
                              const method = paymentMethods.find(pm => pm.id === m.medio_pago_id)
                              const commission = m.comision_monto || 0
                              const net = m.monto - commission
                              return (
                                <div key={m.id} style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{m.descripcion}</div>
                                      <div style={{ fontSize: '0.625rem', color: '#64748b' }}>{new Date(m.creado_en).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})} • {method?.nombre || 'Efectivo'}</div>
                                    </div>
                                    <div style={{ fontWeight: '700', color: isIncome ? '#15803d' : '#b91c1c' }}>{isIncome ? '+' : '-'}${m.monto.toFixed(2)}</div>
                                  </div>
                                  {isIncome && commission > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', paddingTop: '0.25rem', borderTop: '1px dashed #e2e8f0' }}>
                                      <span style={{ color: '#64748b' }}>Comisión: -${commission.toFixed(2)}</span>
                                      <span style={{ color: '#059669', fontWeight: '600' }}>Neto: +${net.toFixed(2)}</span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {showOpenShift && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}> Abrir Caja</h2>
              <button onClick={() => setShowOpenShift(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleOpenShift}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Monto inicial en caja</label>
                
                {lastShiftBalance > 0 && (
                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.875rem', color: '#1e40af' }}>
                    💡 <strong>Sugerencia:</strong> El último cierre fue de <strong>${lastShiftBalance.toFixed(2)}</strong>.
                  </div>
                )}

                <input 
                  type="number" step="0.01" min="0" value={openingAmount} onChange={handleOpeningAmountChange} 
                  placeholder="0.00" required autoFocus
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1.5rem', fontWeight: '700', border: isAmountModified ? '2px solid #f59e0b' : '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box', textAlign: 'right', backgroundColor: isAmountModified ? '#fffbeb' : 'white' }}
                />
                
                {isAmountModified && (
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#b45309', fontSize: '0.875rem' }}>
                      ⚠️ Motivo de la diferencia (Obligatorio)
                    </label>
                    <textarea 
                      value={differenceReason}
                      onChange={(e) => setDifferenceReason(e.target.value)}
                      placeholder="Ej: Saqué $2000 para pagar el flete, faltante de caja, etc."
                      required
                      rows="3"
                      style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', border: '2px solid #f59e0b', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                )}
              </div>

              <button 
                type="submit" disabled={creating}
                style={{ width: '100%', padding: '1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}
              >
                {creating ? 'Abriendo...' : 'Confirmar Apertura'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showCloseShift && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>🔒 Cerrar Caja</h2>
              <button onClick={() => setShowCloseShift(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Monto inicial:</span>
                <span style={{ fontWeight: '600' }}>${activeShift?.monto_inicial.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Entradas Brutas:</span>
                <span style={{ fontWeight: '600', color: '#15803d' }}>+${totals.in.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Comisiones:</span>
                <span style={{ fontWeight: '600', color: '#dc2626' }}>-${totals.commissions.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Entradas Netas:</span>
                <span style={{ fontWeight: '600', color: '#059669' }}>+${totals.net.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Salidas (Gastos):</span>
                <span style={{ fontWeight: '600', color: '#b91c1c' }}>-${totals.out.toFixed(2)}</span>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '700' }}>Saldo final real:</span>
                <span style={{ fontWeight: '700', fontSize: '1.125rem' }}>${currentBalance.toFixed(2)}</span>
              </div>
            </div>

            <button onClick={handleCloseShift} disabled={creating} style={{ width: '100%', padding: '1rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}>
              {creating ? 'Cerrando...' : 'Confirmar Cierre'}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: formType === 'INCOME' ? '#15803d' : '#b91c1c' }}>{formType === 'INCOME' ? '💰 Cobro' : '💸 Gasto'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>¿Cuánto?</label>
                <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required autoFocus style={{ width: '100%', padding: '0.75rem', fontSize: '1.5rem', fontWeight: '700', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box', textAlign: 'right' }} />
              </div>

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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>Medio de pago *</label>
                {paymentMethods.length === 0 ? (
                  <div style={{ padding: '0.75rem', backgroundColor: '#fef3c7', borderRadius: '6px', color: '#92400e', fontSize: '0.875rem' }}>⚠️ No hay medios de pago configurados</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    {paymentMethods.map(method => (
                      <label key={method.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', border: selectedMethod === method.id ? `2px solid ${formType === 'INCOME' ? '#16a34a' : '#dc2626'}` : '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', backgroundColor: selectedMethod === method.id ? (formType === 'INCOME' ? '#f0fdf4' : '#fef2f2') : 'white' }}>
                        <input type="radio" name="method" value={method.id} checked={selectedMethod === method.id} onChange={() => setSelectedMethod(method.id)} style={{ width: '16px', height: '16px' }} />
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{method.nombre}</div>
                          {method.subtipo && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{method.subtipo}</div>}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" disabled={creating} style={{ width: '100%', padding: '1rem', backgroundColor: formType === 'INCOME' ? '#16a34a' : '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}>
                {creating ? 'Guardando...' : 'Confirmar'}
              </button>
            </form>
          </div>
        </div>
      )}

      <BottomNav activeTab="caja" />
    </main>
  )
}

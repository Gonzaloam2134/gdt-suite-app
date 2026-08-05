import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [transactions, setTransactions] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  
  const [transactionType, setTransactionType] = useState('PAYMENT_RECEIVED')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [creating, setCreating] = useState(false)
  
  const [commissionAmount, setCommissionAmount] = useState(0)
  const [netAmount, setNetAmount] = useState(0)
  
  const router = useRouter()
  const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkspaceId') : null

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
        if (activeWorkspaceId) {
          loadData(session.user.id)
        } else {
          router.push('/workspaces')
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) router.push('/')
      else setUser(session.user)
    })

    return () => subscription.unsubscribe()
  }, [router, activeWorkspaceId])

  const loadData = async (userId) => {
    try {
      setLoading(true)
      setError(null)

      if (!activeWorkspaceId) {
        router.push('/workspaces')
        return
      }

      const { data: wsData, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', activeWorkspaceId)
        .single()

      if (wsError) throw wsError
      setWorkspaces(wsData ? [wsData] : [])

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (txError) throw txError
      setTransactions(txData || [])

    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadPaymentMethods = async (workspaceId) => {
    if (!workspaceId) return
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('type', { ascending: true })
      .order('name', { ascending: true })

    if (!error) setPaymentMethods(data || [])
  }

  const calculateCommission = (amount, method) => {
    if (!method || !amount) return { commission: 0, net: amount }
    let commission = 0
    const amountNum = parseFloat(amount)
    if (method.commission_type === 'PERCENTAGE') {
      commission = (amountNum * method.commission_value) / 100
    } else if (method.commission_type === 'FIXED') {
      commission = method.commission_fixed || 0
    } else if (method.commission_type === 'MIXED') {
      commission = ((amountNum * method.commission_value) / 100) + (method.commission_fixed || 0)
    }
    return { commission, net: amountNum - commission }
  }

  const handleAmountChange = (value) => {
    setAmount(value)
    const method = paymentMethods.find(m => m.id === selectedPaymentMethod)
    if (method && value) {
      const { commission, net } = calculateCommission(value, method)
      setCommissionAmount(commission)
      setNetAmount(net)
    } else {
      setCommissionAmount(0)
      setNetAmount(parseFloat(value) || 0)
    }
  }

  const handlePaymentMethodChange = (methodId) => {
    setSelectedPaymentMethod(methodId)
    const method = paymentMethods.find(m => m.id === methodId)
    if (method && amount) {
      const { commission, net } = calculateCommission(amount, method)
      setCommissionAmount(commission)
      setNetAmount(net)
    } else {
      setCommissionAmount(0)
      setNetAmount(parseFloat(amount) || 0)
    }
  }

  const handleCreateTransaction = async (e) => {
    e.preventDefault()
    if (!activeWorkspaceId) return alert('No hay workspace activo!')
    if (!amount || amount <= 0) return alert('Ingresá un monto válido!')
    if (!description.trim()) return alert('Ingresá una descripción!')
    if (!selectedPaymentMethod) return alert('Seleccioná un medio de pago!')

    try {
      setCreating(true)
      const workspace = workspaces[0]
      const paymentMethod = paymentMethods.find(pm => pm.id === selectedPaymentMethod)
      
      const { data: business, error: businessError } = await supabase.from('businesses').insert([{ workspace_id: workspace.id, name: 'Negocio Demo', legal_name: 'Negocio Demo S.A.', tax_id: '30-12345678-9' }]).select()
      if (businessError) throw businessError

      const { data: branch, error: branchError } = await supabase.from('branches').insert([{ business_id: business[0].id, name: 'Sucursal Centro', code: 'SUC-001', address: 'Av. Principal 123' }]).select()
      if (branchError) throw branchError

      const { data: cashPoint, error: cashPointError } = await supabase.from('cash_points').insert([{ branch_id: branch[0].id, name: 'Caja Principal', code: 'CAJA-001' }]).select()
      if (cashPointError) throw cashPointError

      const { data: shift, error: shiftError } = await supabase.from('shifts').insert([{ cash_point_id: cashPoint[0].id, opened_by: user.id, status: 'OPEN', initial_amount: 1000.00 }]).select()
      if (shiftError) throw shiftError

      const { data: transaction, error: txError } = await supabase.from('transactions').insert([{
        shift_id: shift[0].

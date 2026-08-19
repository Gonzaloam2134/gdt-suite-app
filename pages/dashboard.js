import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { formatCurrency } from '../lib/format'
import toast from 'react-hot-toast'
import ReversaModal from '../components/ReversaModal'
import ContactModal from '../components/ContactModal'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [local, setLocal] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [saldo, setSaldo] = useState(0)
  const [cobros, setCobros] = useState([])
  const [gastos, setGastos] = useState([])
  
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

  const cargarCaja = async (localId) => {
    try {
      setLoading(true)
      
      // Obtener transacciones de los últimos 30 días
      const fechaDesde = new Date()
      fechaDesde.setDate(fechaDesde.getDate() - 30)
      
      const { data: transacciones } = await supabase
        .from('transacciones')
        .select(`
          *,
          medios_pago (nombre, tipo, icono)
        `)
        .eq('local_id', localId)
        .gte('creado_en', fechaDesde.toISOString())
        .order('creado_en', { ascending: false })
      
      const cobrosData = transacciones?.filter(t => t.tipo === 'COBRO_RECIBIDO') || []
      const gastosData = transacciones?.filter(t => t.tipo === 'GASTO_REGISTRADO') || []
      
      setCobros(cobrosData)
      setGastos(gastosData)
      
      // Calcular saldo
      const totalCobros = cobrosData.reduce((sum, t) => sum + (t.monto || 0), 0)
      const totalGastos = gastosData.reduce((sum, t) => sum + (t.monto || 0), 0)
      setSaldo(totalCobros - totalGastos)
      
    } catch (err) {
      console.error('Error cargando caja:', err)
      toast.error('Error al cargar datos de la caja')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    if (local) cargarCaja(local.id)
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p>Cargando caja...</p></div>
  if (!user || !local) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p>Cargando...</p></div>

  return (
    <main className="min-h-screen bg-slate-100 pb-8">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="m-0 text-lg font-bold text-gray-900">💰 Caja - {local.nombre}</h1>
            <p className="mt-0.5 text-xs text-gray-500">Últimos 30 días</p>
          </div>
          <div className="flex gap-2">
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
              onClick={() => setShowContactModal(true)}
              className="px-3 py-1.5 bg-blue-100 text-blue-700 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-200"
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
        {/* Saldo */}
        <div className={`rounded-xl border-2 p-6 mb-6 ${saldo >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
          <div className="text-sm text-gray-600 font-semibold mb-1">SALDO ACTUAL</div>
          <div className={`text-4xl font-extrabold ${saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatCurrency(saldo)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {cobros.length} cobros · {gastos.length} gastos
          </div>
        </div>

        {/* Cobros */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
          <div className="bg-green-600 p-3 text-white font-bold text-sm flex justify-between items-center">
            <span>💵 COBROS RECIBIDOS</span>
            <span className="text-xs font-normal">{cobros.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-2 text-left text-gray-600 font-bold">Fecha</th>
                  <th className="p-2 text-left text-gray-600 font-bold">Medio</th>
                  <th className="p-2 text-left text-gray-600 font-bold">Descripción</th>
                  <th className="p-2 text-right text-gray-600 font-bold">Monto</th>
                  <th className="p-2 text-center text-gray-600 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cobros.map((cobro) => (
                  <tr 
                    key={cobro.id} 
                    className={`border-b border-gray-100 ${cobro.es_reversa ? 'bg-red-50 opacity-75' : 'hover:bg-gray-50'}`}
                  >
                    <td className="p-2 text-gray-900">
                      {new Date(cobro.creado_en).toLocaleDateString('es-AR')}
                      {cobro.es_reversa && <span className="ml-1 text-xs text-red-600">️</span>}
                    </td>
                    <td className="p-2 text-gray-700">{cobro.medios_pago?.nombre || '-'}</td>
                    <td className="p-2 text-gray-700">
                      <span className={cobro.es_reversa ? 'line-through' : ''}>
                        {cobro.descripcion || 'Sin descripción'}
                      </span>
                      {cobro.es_reversa && (
                        <div className="text-xs text-red-600 mt-1">
                          Motivo: {cobro.motivo_reversa || 'N/A'}
                        </div>
                      )}
                    </td>
                    <td className={`p-2 text-right font-bold ${cobro.es_reversa ? 'text-red-600' : 'text-green-700'}`}>
                      {cobro.es_reversa ? '-' : ''}{formatCurrency(Math.abs(cobro.monto || 0))}
                    </td>
                    <td className="p-2 text-center">
                      {!cobro.es_reversa && (
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
                      )}
                      {cobro.es_reversa && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-semibold">
                          REVERSA
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {cobros.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500 text-sm">
                      No hay cobros registrados en los últimos 30 días
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gastos */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-red-600 p-3 text-white font-bold text-sm flex justify-between items-center">
            <span>💸 GASTOS REGISTRADOS</span>
            <span className="text-xs font-normal">{gastos.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-2 text-left text-gray-600 font-bold">Fecha</th>
                  <th className="p-2 text-left text-gray-600 font-bold">Medio</th>
                  <th className="p-2 text-left text-gray-600 font-bold">Descripción</th>
                  <th className="p-2 text-right text-gray-600 font-bold">Monto</th>
                  <th className="p-2 text-center text-gray-600 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((gasto) => (
                  <tr 
                    key={gasto.id} 
                    className={`border-b border-gray-100 ${gasto.es_reversa ? 'bg-red-50 opacity-75' : 'hover:bg-gray-50'}`}
                  >
                    <td className="p-2 text-gray-900">
                      {new Date(gasto.creado_en).toLocaleDateString('es-AR')}
                      {gasto.es_reversa && <span className="ml-1 text-xs text-red-600">️</span>}
                    </td>
                    <td className="p-2 text-gray-700">{gasto.medios_pago?.nombre || '-'}</td>
                    <td className="p-2 text-gray-700">
                      <span className={gasto.es_reversa ? 'line-through' : ''}>
                        {gasto.descripcion || 'Sin descripción'}
                      </span>
                      {gasto.es_reversa && (
                        <div className="text-xs text-red-600 mt-1">
                          Motivo: {gasto.motivo_reversa || 'N/A'}
                        </div>
                      )}
                    </td>
                    <td className={`p-2 text-right font-bold ${gasto.es_reversa ? 'text-green-600' : 'text-red-700'}`}>
                      {gasto.es_reversa ? '' : '-'}{formatCurrency(Math.abs(gasto.monto || 0))}
                    </td>
                    <td className="p-2 text-center">
                      {!gasto.es_reversa && (
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
                      )}
                      {gasto.es_reversa && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-semibold">
                          REVERSA
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {gastos.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500 text-sm">
                      No hay gastos registrados en los últimos 30 días
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modales */}
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

      {/* Aquí irían los modales de Cobro y Gasto (que ya tenés implementados) */}
      {/* ... */}
    </main>
  )
}

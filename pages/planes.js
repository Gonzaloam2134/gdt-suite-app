import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useUserRole } from '../lib/UserRoleContext'
import { useMisLocales } from '../hooks/useMisLocales'
import { listarPlanes } from '../lib/services/planes'
import { supabase } from '../lib/supabaseClient'
import { SEGMENTO, CICLO, LABEL_SEGMENTO, LABEL_CICLO, DESCRIPCION_SEGMENTO, CARACTERISTICAS_SEGMENTO } from '../lib/constants/planes'
import { formatCurrency } from '../lib/format'
import LoadingScreen from '../components/ui/LoadingScreen'
import AppHeader from '../components/layout/AppHeader'
import BottomNav from '../components/layout/BottomNav'

const SEGMENTOS = Object.values(SEGMENTO)

/**
 * Vidriera de precios, con el botón de pago conectado a Mercado Pago:
 * crea la suscripción del lado del servidor (pages/api/suscripcion/crear.js)
 * y redirige al checkout. La activación real la hace el webhook, no esta
 * pantalla.
 *
 * Lleva BottomNav y el nav de AppHeader igual que cualquier otra pantalla:
 * si alguien aterriza acá por el vencimiento de la prueba, tiene que poder
 * seguir a Reportes en un toque — nunca queda encerrado eligiendo un plan.
 */
export default function Planes() {
  const router = useRouter()
  const { user, checking } = useAuthGuard()
  const { activeLocalId } = useUserRole()
  const { locales } = useMisLocales(user?.id)
  const [ciclo, setCiclo] = useState(CICLO.MENSUAL)
  const [precios, setPrecios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [pagando, setPagando] = useState(null) // segmento en proceso de pago, o null
  const [errorPago, setErrorPago] = useState('')

  const vieneDePruebaVencida = router.query.motivo === 'prueba-vencida'

  useEffect(() => {
    listarPlanes().then(setPrecios).finally(() => setCargando(false))
  }, [])

  const elegirPlan = async (segmento) => {
    setErrorPago('')
    setPagando(segmento)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/suscripcion/crear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ segmento, ciclo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo iniciar el pago')
      window.location.href = data.initPoint
    } catch (err) {
      setErrorPago(err.message || 'No se pudo iniciar el pago. Probá de nuevo.')
      setPagando(null)
    }
  }

  if (checking || cargando) return <LoadingScreen mensaje="Cargando planes…" />

  const precioDe = (segmento) => precios.find(p => p.segmento === segmento && p.ciclo === ciclo)

  // De más barato a más caro, siempre — según el precio real de la base, no
  // un orden fijo en el código. Si el día de mañana cambiás los precios y el
  // orden relativo se invierte, la vidriera se reordena sola.
  const orden = [...SEGMENTOS].sort((a, b) => {
    const pa = precios.find(p => p.segmento === a && p.ciclo === 'mensual')?.precio ?? 0
    const pb = precios.find(p => p.segmento === b && p.ciclo === 'mensual')?.precio ?? 0
    return pa - pb
  })

  return (
    <main className="min-h-screen bg-slate-100 pb-20 md:pb-10">
      <AppHeader titulo="Planes" locales={locales} localId={activeLocalId} />

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {vieneDePruebaVencida ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <h1 className="text-lg font-bold text-blue-900 m-0">Tu prueba de 30 días terminó</h1>
            <p className="text-sm text-blue-800 mt-1 m-0">
              Elegí un plan para seguir abriendo caja y cargando cobros. Mientras tanto, tus reportes
              siguen siempre disponibles desde el menú de arriba.
            </p>
          </div>
        ) : (
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900 m-0">Elegí tu plan</h1>
            <p className="text-sm text-gray-500 mt-1 m-0">Pagás una vez por tu cuenta — Básico y Negocio cubren un local, Multi-local no tiene límite.</p>
          </div>
        )}

        {errorPago && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center text-sm text-red-700">
            {errorPago}
          </div>
        )}

        <div className="flex justify-center gap-2">
          {Object.values(CICLO).map(c => (
            <button key={c} onClick={() => setCiclo(c)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer ${
                ciclo === c ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {LABEL_CICLO[c]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {orden.map(segmento => {
            const precio = precioDe(segmento)
            return (
              <div key={segmento} className="bg-white rounded-xl border-2 border-gray-200 p-5 flex flex-col">
                <h2 className="text-lg font-bold text-gray-900 m-0">{LABEL_SEGMENTO[segmento]}</h2>
                <p className="text-xs text-gray-500 mt-1 mb-3">{DESCRIPCION_SEGMENTO[segmento]}</p>

                <div className="text-2xl font-extrabold text-gray-900 mb-1">
                  {precio ? formatCurrency(precio.precio) : '—'}
                  <span className="text-xs font-normal text-gray-400"> /{ciclo === 'mensual' ? 'mes' : 'año'}</span>
                </div>
                <p className="text-xs text-gray-400 mb-3 m-0">
                  {segmento === SEGMENTO.MULTI_LOCAL ? 'Cubre todos tus locales, sin límite' : 'Cubre un solo local'}
                </p>

                <ul className="flex-1 space-y-1.5 my-3 pl-0 list-none">
                  {CARACTERISTICAS_SEGMENTO[segmento].map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="text-green-600 shrink-0 mt-0.5">✓</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>

                <button onClick={() => elegirPlan(segmento)} disabled={pagando !== null}
                  className="mt-3 w-full p-2.5 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed">
                  {pagando === segmento ? 'Redirigiendo…' : 'Elegir plan'}
                </button>
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-gray-400">
          ¿Querés ver tus reportes primero?{' '}
          <button onClick={() => router.push('/reportes')}
            className="text-blue-600 font-semibold bg-transparent border-none cursor-pointer hover:underline">
            Ir a Reportes
          </button>
        </p>
      </div>

      <BottomNav activeTab="planes" />
    </main>
  )
}

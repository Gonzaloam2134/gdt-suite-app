import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useUserRole } from '../lib/UserRoleContext'
import { listarPlanes } from '../lib/services/planes'
import { SEGMENTO, CICLO, LABEL_SEGMENTO, LABEL_CICLO, DESCRIPCION_SEGMENTO } from '../lib/constants/planes'
import { formatCurrency } from '../lib/format'
import LoadingScreen from '../components/ui/LoadingScreen'
import AppHeader from '../components/layout/AppHeader'

const ORDEN = [SEGMENTO.BASICO, SEGMENTO.NEGOCIO, SEGMENTO.MULTI_LOCAL]

/**
 * Vidriera de precios. El botón de pago se conecta cuando esté Mercado Pago
 * (Parte 2) — por ahora, si alguien llega acá porque tocó el límite de su
 * plan, al menos entiende qué opciones tiene y por qué.
 */
export default function Planes() {
  const router = useRouter()
  const { checking } = useAuthGuard()
  const { activeLocalId } = useUserRole()
  const [ciclo, setCiclo] = useState(CICLO.MENSUAL)
  const [precios, setPrecios] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    listarPlanes().then(setPrecios).finally(() => setCargando(false))
  }, [])

  if (checking || cargando) return <LoadingScreen mensaje="Cargando planes…" />

  const precioDe = (segmento) => precios.find(p => p.segmento === segmento && p.ciclo === ciclo)

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <AppHeader titulo="Planes" locales={[]} localId={null} />

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 m-0">Elegí el plan de tu local</h1>
          <p className="text-sm text-gray-500 mt-1 m-0">Cada local paga el suyo. Si ya tenés otro local pago, este sale con descuento.</p>
        </div>

        <div className="flex justify-center gap-2">
          {Object.values(CICLO).map(c => (
            <button key={c} onClick={() => setCiclo(c)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer ${
                ciclo === c ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {LABEL_CICLO[c]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ORDEN.map(segmento => {
            const precio = precioDe(segmento)
            return (
              <div key={segmento} className="bg-white rounded-xl border-2 border-gray-200 p-5 flex flex-col">
                <h2 className="text-lg font-bold text-gray-900 m-0">{LABEL_SEGMENTO[segmento]}</h2>
                <p className="text-xs text-gray-500 mt-1 mb-4 flex-1">{DESCRIPCION_SEGMENTO[segmento]}</p>
                <div className="text-2xl font-extrabold text-gray-900 mb-1">
                  {precio ? formatCurrency(precio.precio) : '—'}
                  <span className="text-xs font-normal text-gray-400"> /{ciclo === 'mensual' ? 'mes' : 'año'}</span>
                </div>
                {segmento === SEGMENTO.MULTI_LOCAL && (
                  <p className="text-xs text-gray-400 mb-3 m-0">Por cada local además del primero</p>
                )}
                <button disabled
                  className="mt-4 w-full p-2.5 bg-gray-100 text-gray-400 border-none rounded-lg text-sm font-bold cursor-not-allowed">
                  Próximamente
                </button>
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-gray-400">
          ¿Ya sos parte de un local? <button onClick={() => router.push(activeLocalId ? '/dashboard' : '/locales')}
            className="text-blue-600 font-semibold bg-transparent border-none cursor-pointer hover:underline">Volver</button>
        </p>
      </div>
    </main>
  )
}

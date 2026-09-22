import { useRouter } from 'next/router'
import { REEMBOLSOS_TEXTO } from '../lib/constants/legal'
import TerminosContenido from '../components/legal/TerminosContenido'

/** Pública, sin auth guard — se linkea desde /planes, cerca del pago. */
export default function Reembolsos() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-slate-100 pb-12">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <h1 className="m-0 text-base font-bold text-gray-900">Política de Reembolsos</h1>
          <button onClick={() => router.push('/')}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200">
            Volver
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 md:p-6 mt-4 bg-white rounded-xl border border-gray-200">
        <TerminosContenido texto={REEMBOLSOS_TEXTO} />
      </div>
    </main>
  )
}

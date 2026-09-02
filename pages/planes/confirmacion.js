import { useRouter } from 'next/router'

/**
 * back_url de Mercado Pago. Solo experiencia visual de vuelta — la
 * activación real la hace el webhook (pages/api/webhooks/mercadopago.js),
 * esta pantalla no intenta activar nada por su cuenta.
 */
export default function Confirmacion() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full text-center space-y-3">
        <h1 className="text-lg font-bold text-gray-900 m-0">Estamos confirmando tu pago</h1>
        <p className="text-sm text-gray-500 m-0">
          Puede tardar unos segundos. Cuando Mercado Pago nos confirme, tu plan queda activo automáticamente.
        </p>
        <button onClick={() => router.push('/locales')}
          className="mt-2 w-full p-2.5 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer">
          Volver a mis locales
        </button>
      </div>
    </main>
  )
}

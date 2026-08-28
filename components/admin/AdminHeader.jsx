import { useRouter } from 'next/router'
import { useSignOut } from '../../hooks/useSignOut'

export default function AdminHeader({ titulo, subtitulo }) {
  const router = useRouter()
  const signOut = useSignOut()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push('/dashboard')}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200 shrink-0">
            ← Caja
          </button>
          <div className="min-w-0">
            <h1 className="m-0 text-base md:text-lg font-bold text-gray-900 truncate">{titulo}</h1>
            {subtitulo && <p className="mt-0.5 text-xs text-gray-500 truncate m-0">{subtitulo}</p>}
          </div>
        </div>
        <button onClick={signOut} className="px-3 py-1.5 bg-gray-100 border-none rounded-md text-gray-500 text-xs font-medium cursor-pointer hover:bg-gray-200 shrink-0">Salir</button>
      </div>
    </header>
  )
}

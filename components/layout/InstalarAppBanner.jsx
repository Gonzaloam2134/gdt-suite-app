import { useState, useEffect } from 'react'
import { usePreferencia } from '../../hooks/usePreferencia'

/**
 * Ofrece instalar la app cuando el navegador lo permite (Android/Chrome/Edge
 * disparan 'beforeinstallprompt'; iOS/Safari no lo soporta y solo se instala
 * a mano desde "Compartir → Agregar a inicio", así que ahí no mostramos nada
 * — un botón que no hace nada en iOS sería peor que no mostrar botón.
 */
export default function InstalarAppBanner() {
  const [prompt, setPrompt] = useState(null)
  const [descartado, setDescartado] = usePreferencia('pwa.instalarDescartado', false)

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  if (!prompt || descartado) return null

  const instalar = async () => {
    prompt.prompt()
    await prompt.userChoice
    setPrompt(null)
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-blue-900 m-0">Instalá GDT Suite en tu celular</p>
        <p className="text-xs text-blue-700 m-0">Abrí la caja como cualquier otra app, sin buscar el navegador.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => setDescartado(true)}
          className="px-3 py-1.5 bg-transparent text-blue-700 border-none text-xs font-semibold cursor-pointer hover:underline">
          Ahora no
        </button>
        <button onClick={instalar}
          className="px-3 py-1.5 bg-blue-600 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700">
          Instalar
        </button>
      </div>
    </div>
  )
}

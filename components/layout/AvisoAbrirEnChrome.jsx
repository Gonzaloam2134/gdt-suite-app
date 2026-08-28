import { useState, useEffect } from 'react'
import { esNavegadorEmbebido, corriendoInstalada } from '../../lib/entornoNavegador'

/**
 * Aviso proactivo cuando la app se abre dentro de WhatsApp/Instagram/Facebook.
 * Ahí 'beforeinstallprompt' nunca dispara (el navegador embebido no lo soporta),
 * así que el banner normal de instalación no aparece — sin este aviso, alguien
 * que llegó por el link de invitación nunca se entera de que instalar es una
 * opción, ni por qué no ve el botón.
 */
export default function AvisoAbrirEnChrome() {
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    if (corriendoInstalada()) return
    setMostrar(esNavegadorEmbebido(navigator.userAgent))
  }, [])

  if (!mostrar) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <p className="text-sm font-bold text-amber-900 m-0">⚠️ Abrí esto en Chrome</p>
      <p className="text-xs text-amber-800 mt-1 m-0">
        Tocá los tres puntos (⋮) arriba a la derecha y elegí "Abrir en Chrome" — desde
        acá adentro no vas a poder instalar la app ni usarla del todo bien.
      </p>
    </div>
  )
}

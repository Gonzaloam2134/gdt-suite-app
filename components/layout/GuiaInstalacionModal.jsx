import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { esIOS, esAndroid, esNavegadorEmbebido, corriendoInstalada } from '../../lib/entornoNavegador'

/**
 * Guía de instalación, siempre accesible desde el menú (AppHeader).
 * El contenido cambia según el dispositivo: Android/Chrome tiene un botón real
 * (beforeinstallprompt); iPhone/Safari se instala a mano y no hay forma de
 * automatizarlo, es una limitación del propio iOS, no de esta app.
 */
export default function GuiaInstalacionModal({ isOpen, onClose }) {
  const [entorno, setEntorno] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    const ua = navigator.userAgent
    setEntorno({
      embebido: esNavegadorEmbebido(ua),
      ios: esIOS(ua),
      android: esAndroid(ua),
      instalada: corriendoInstalada(),
    })
  }, [isOpen])

  if (!entorno) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📲 Instalar GDT Suite" size="md"
      headerClassName="bg-slate-800 text-white"
      footer={<button onClick={onClose} className="w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">Entendido</button>}>

      {entorno.instalada ? (
        <div className="text-center py-4">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-sm font-semibold text-gray-900 m-0">Ya la tenés instalada</p>
          <p className="text-xs text-gray-500 mt-1 m-0">Estás usando la app instalada, no hace falta nada más.</p>
        </div>
      ) : entorno.embebido ? (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm font-bold text-amber-900 m-0">⚠️ Tenés que abrir esto en Chrome</p>
            <p className="text-xs text-amber-800 mt-1 m-0">
              Estás viendo esta página dentro de WhatsApp (o Instagram/Facebook). Ese navegador
              interno no permite instalar apps. Salí de ahí primero:
            </p>
          </div>
          <ol className="space-y-2 text-sm text-gray-700 pl-5 m-0">
            <li>Tocá los <strong>tres puntos</strong> (⋮) arriba a la derecha, donde estás viendo esto.</li>
            <li>Elegí <strong>"Abrir en Chrome"</strong> o <strong>"Abrir en el navegador"</strong>.</li>
            <li>Ya en Chrome, volvé a abrir el menú de esta app y tocá "Instalar" otra vez.</li>
          </ol>
        </div>
      ) : entorno.ios ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 m-0">En iPhone se instala a mano desde Safari — es así para todas las apps web, no es algo particular de GDT Suite:</p>
          <ol className="space-y-2.5 text-sm text-gray-700 pl-5 m-0">
            <li>Abrí esta página en <strong>Safari</strong> (no en Chrome: en iPhone, solo Safari puede instalar).</li>
            <li>Tocá el ícono de <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba), abajo en el medio.</li>
            <li>Deslizá y elegí <strong>"Agregar a inicio"</strong>.</li>
            <li>Tocá "Agregar" arriba a la derecha.</li>
          </ol>
          <p className="text-xs text-gray-400 m-0">Va a aparecer un ícono en tu pantalla de inicio, igual que cualquier otra app.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 m-0">
            {entorno.android
              ? 'En tu celular, tiene que ser desde Chrome (el navegador que ya viene instalado en Android):'
              : 'Desde una compu, en Chrome o Edge:'}
          </p>
          <ol className="space-y-2.5 text-sm text-gray-700 pl-5 m-0">
            <li>Si ves un aviso "Instalar" en la pantalla, tocalo directamente.</li>
            <li>Si no lo ves, tocá los <strong>tres puntos</strong> (⋮) arriba a la derecha del navegador.</li>
            <li>Elegí <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla de inicio"</strong>.</li>
          </ol>
          <p className="text-xs text-gray-400 m-0">
            Si abriste este link desde WhatsApp, primero tenés que abrirlo en Chrome propiamente
            (tres puntos → "Abrir en Chrome") — desde adentro de WhatsApp no funciona.
          </p>
        </div>
      )}
    </Modal>
  )
}

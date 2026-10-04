import Button from '../ui/Button'

/**
 * Red de seguridad cuando no hay local activo (el redirect de useActiveLocal
 * tarda o se corta): dice por qué no hay caja y ofrece una salida.
 */
export default function SinLocalSeleccionado({ onIr }) {
  return (
    <main className="min-h-screen bg-fondo flex items-center justify-center p-6">
      <div className="bg-white rounded-[24px] border border-black/5 shadow-suave p-6 max-w-sm text-center">
        <div className="text-4xl mb-3">🏪</div>
        <p className="text-sm font-semibold text-gray-900 m-0 mb-1">No hay ningún local seleccionado</p>
        <p className="text-xs text-gray-500 mb-4">Elegí un local para ver su caja.</p>
        <Button onClick={onIr} className="w-full !rounded-[14px]">Ir a Mis locales</Button>
      </div>
    </main>
  )
}

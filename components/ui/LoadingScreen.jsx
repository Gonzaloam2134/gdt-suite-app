/** Pantalla de carga única para toda la app (antes cada página tenía la suya). */
export default function LoadingScreen({ mensaje = 'Cargando…', icono = '⏳' }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center" role="status" aria-live="polite">
        <div className="text-4xl mb-3">{icono}</div>
        <p className="text-gray-500 m-0">{mensaje}</p>
      </div>
    </div>
  )
}

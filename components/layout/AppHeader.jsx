import SelectorLocal from './SelectorLocal'

export default function AppHeader({ titulo, subtitulo, locales = [], localId, onCambiarLocal, permiteTodos, acciones, ocultarNavDesktop = false, sinLocal = false }) {
  return (
    <header className="bg-fondo/90 backdrop-blur-md border-b border-black/5 sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {sinLocal ? (
            <h1 className="m-0 text-base font-bold text-gray-900 truncate">{titulo}</h1>
          ) : (
            <>
              <SelectorLocal locales={locales} localId={localId} onCambiar={onCambiarLocal} permiteTodos={permiteTodos} />
              <div className="hidden md:block min-w-0 border-l border-gray-200 pl-3">
                <h1 className="m-0 text-sm font-bold text-gray-900 truncate">{titulo}</h1>
                {subtitulo && <p className="mt-0 text-xs text-gray-500 truncate m-0">{subtitulo}</p>}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {acciones}
        </div>
      </div>
      {!sinLocal && <div className="md:hidden px-3 pb-2">
        <h1 className="m-0 text-xs font-semibold text-gray-500 truncate">{titulo}{subtitulo ? ` · ${subtitulo}` : ''}</h1>
      </div>}
    </header>
  )
}

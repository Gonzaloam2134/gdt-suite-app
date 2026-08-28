import { useState } from 'react'

/**
 * Card con título, toggle de colapso y paginación opcional.
 * Usada por las listas del dashboard (cobros, gastos, acreditaciones, desglose).
 * Recibe `paginacion` = resultado de usePaginacion.
 */
export default function SeccionColapsable({ titulo, badge, children, paginacion, abiertaPorDefecto = true, acciones }) {
  const [abierta, setAbierta] = useState(abiertaPorDefecto)
  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={() => setAbierta(a => !a)} className="flex items-center gap-2 bg-transparent border-none cursor-pointer text-left" aria-expanded={abierta}>
          <span className="text-gray-400 text-xs">{abierta ? '▼' : '▶'}</span>
          <h3 className="font-bold text-gray-900 m-0 text-sm md:text-base">{titulo}</h3>
          {badge != null && <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{badge}</span>}
        </button>
        {acciones}
      </header>
      {abierta && (
        <>
          <div>{children}</div>
          {paginacion && paginacion.totalPaginas > 1 && (
            <footer className="flex items-center justify-between px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
              <button onClick={paginacion.anterior} disabled={paginacion.pagina === 1} className="px-2 py-1 rounded bg-gray-100 disabled:opacity-40 cursor-pointer border-none">‹ Anterior</button>
              <span>Página {paginacion.pagina} de {paginacion.totalPaginas}</span>
              <button onClick={paginacion.siguiente} disabled={paginacion.pagina === paginacion.totalPaginas} className="px-2 py-1 rounded bg-gray-100 disabled:opacity-40 cursor-pointer border-none">Siguiente ›</button>
            </footer>
          )}
        </>
      )}
    </section>
  )
}

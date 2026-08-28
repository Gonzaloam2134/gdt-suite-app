import { useMemo, useState } from 'react'

/** Paginación en memoria para listas cortas (cobros/gastos del día). */
export function usePaginacion(items = [], porPagina = 15) {
  const [pagina, setPagina] = useState(1)
  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = useMemo(
    () => items.slice((paginaActual - 1) * porPagina, paginaActual * porPagina),
    [items, paginaActual, porPagina],
  )
  return {
    visibles, pagina: paginaActual, totalPaginas,
    siguiente: () => setPagina(p => Math.min(p + 1, totalPaginas)),
    anterior: () => setPagina(p => Math.max(p - 1, 1)),
    reset: () => setPagina(1),
  }
}

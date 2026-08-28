const ESTILO = {
  alto:  { fondo: 'bg-red-50 border-red-200', texto: 'text-red-800', icono: '⚠️' },
  medio: { fondo: 'bg-amber-50 border-amber-200', texto: 'text-amber-800', icono: '⚠️' },
  info:  { fondo: 'bg-blue-50 border-blue-200', texto: 'text-blue-800', icono: 'ℹ️' },
}

/**
 * Qué le falta al dato. Va antes de los números: si el contador no sabe que el 60%
 * de las ventas no tiene comprobante, toma el reporte como completo.
 */
export default function AvisosCalidad({ calidad }) {
  if (!calidad.avisos.length) return null

  return (
    <div className="space-y-2">
      {calidad.avisos.map((a, i) => {
        const e = ESTILO[a.nivel] || ESTILO.info
        return (
          <div key={i} className={`flex items-start gap-2 p-3 rounded-lg border ${e.fondo}`}>
            <span className="shrink-0">{e.icono}</span>
            <p className={`text-sm m-0 ${e.texto}`}>{a.texto}</p>
          </div>
        )
      })}
    </div>
  )
}

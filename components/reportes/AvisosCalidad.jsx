import Icono from '../ui/Icono'

const ESTILO = {
  alto:  { fondo: 'bg-red-50 border-red-200', texto: 'text-red-800', icono: 'alerta' },
  medio: { fondo: 'bg-amber-50 border-amber-200', texto: 'text-amber-800', icono: 'alerta' },
  info:  { fondo: 'bg-primary-50 border-primary-500/30', texto: 'text-primary-700', icono: 'info' },
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
          <div key={i} className={`flex items-start gap-2 p-3 rounded-[14px] border ${e.fondo}`}>
            <span className="shrink-0"><Icono nombre={e.icono} size={18} /></span>
            <p className={`text-sm m-0 ${e.texto}`}>{a.texto}</p>
          </div>
        )
      })}
    </div>
  )
}

import { useState } from 'react'
import Sparkline from './Sparkline'
import { serieDiaria, calcularTendencia } from '../../lib/domain/tendenciaNegocio'
import { formatCurrency, formatFecha } from '../../lib/format'
import { desdeFechaISO } from '../../lib/dates'

/**
 * "Cómo viene el negocio": ventas por día del período + un insight corto.
 * Si no hay historial suficiente para un insight real, lo dice (y por qué)
 * en vez de mostrar un texto genérico.
 */
export default function TarjetaNegocio({ porDia, periodo }) {
  const [activo, setActivo] = useState(null)
  const serie = serieDiaria(porDia, periodo.desde, periodo.hasta)
  const tendencia = calcularTendencia(serie)
  const hayVentas = serie.some(d => d.ventas > 0)

  const punto = activo != null ? serie[activo] : null
  const pct = tendencia.estado === 'ok' ? Math.round(tendencia.porcentaje) : null

  return (
    <section className="bg-white rounded-[20px] border border-black/5 shadow-suave p-4">
      <h2 className="m-0 text-base font-bold text-gray-900">Cómo viene el negocio</h2>
      <p className="m-0 mt-0.5 text-xs text-gray-500 min-h-[1rem]">
        {punto ? `${formatFecha(desdeFechaISO(punto.fecha))} · ${formatCurrency(punto.ventas)}` : 'Ventas por día, hasta ayer'}
      </p>

      {hayVentas ? (
        <div className="mt-3">
          <Sparkline puntos={serie.map(d => d.ventas)} onActivo={setActivo}
            etiqueta={`Ventas diarias de ${serie.length} días, del ${formatFecha(desdeFechaISO(serie[0].fecha))} al ${formatFecha(desdeFechaISO(serie[serie.length - 1].fecha))}`} />
        </div>
      ) : (
        <p className="mt-3 mb-0 text-sm text-gray-500">Todavía no hay ventas completas en este período para graficar.</p>
      )}

      {tendencia.estado === 'ok' ? (
        <p className="m-0 mt-3 text-sm text-gray-800">
          {Math.abs(pct) < 3
            ? <>Los últimos 7 días vendiste <strong>{formatCurrency(tendencia.ultimos)}</strong>, parecido a los 7 anteriores ({formatCurrency(tendencia.anteriores)}).</>
            : <>Los últimos 7 días vendiste <strong>{formatCurrency(tendencia.ultimos)}</strong>: <strong className={pct > 0 ? 'text-primary-700' : 'text-danger-700'}>{Math.abs(pct)}% {pct > 0 ? 'más' : 'menos'}</strong> que los 7 anteriores ({formatCurrency(tendencia.anteriores)}).</>}
        </p>
      ) : (
        <p className="m-0 mt-3 p-3 rounded-[14px] bg-fondo text-xs text-gray-600">
          Todavía no hay historial para una comparación confiable. {tendencia.motivo} Probá con "Últimos 30 días" o "Trimestre".
        </p>
      )}
    </section>
  )
}

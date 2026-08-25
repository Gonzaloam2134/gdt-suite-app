import { useState } from 'react'
import { formatCurrency } from '../../lib/format'

const TONOS = {
  verde:    { borde: 'border-green-300',   texto: 'text-green-700',   fondo: 'bg-white' },
  rojo:     { borde: 'border-red-300',     texto: 'text-red-700',     fondo: 'bg-white' },
  azul:     { borde: 'border-blue-300',    texto: 'text-blue-700',    fondo: 'bg-white' },
  esmeralda:{ borde: 'border-emerald-300', texto: 'text-emerald-700', fondo: 'bg-white' },
  ambar:    { borde: 'border-amber-300',   texto: 'text-amber-700',   fondo: 'bg-white' },
}

/** Tarjeta de métrica con ayuda desplegable. Una sola definición para mobile y desktop. */
export default function KpiCard({ titulo, valor, detalle, tono = 'azul', ayuda, destacada = false, negativo = false }) {
  const [abierta, setAbierta] = useState(false)
  const t = TONOS[tono] ?? TONOS.azul
  const colorValor = negativo ? 'text-red-700' : t.texto
  const fondo = negativo ? 'bg-red-50' : t.fondo
  const borde = negativo ? 'border-red-300' : t.borde

  return (
    <div className={`${fondo} rounded-xl border-2 ${borde} p-3 md:p-4 relative`}>
      <div className="flex justify-between items-start mb-1 gap-2">
        <div className="text-xs text-gray-600 font-semibold uppercase">{titulo}</div>
        {ayuda && (
          <button onClick={() => setAbierta(a => !a)} aria-label={`Qué incluye ${titulo}`} aria-expanded={abierta}
            className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs p-1 bg-transparent border-none leading-none">ℹ️</button>
        )}
      </div>
      <div className={`font-extrabold ${colorValor} ${destacada ? 'text-lg md:text-2xl' : 'text-base md:text-2xl'}`}>
        {formatCurrency(valor)}
      </div>
      {detalle && <div className="text-xs text-gray-500 mt-1">{detalle}</div>}
      {abierta && ayuda && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">{ayuda}</div>
      )}
    </div>
  )
}

import { formatCurrency } from '../../lib/format'

/** Consolidado del día de todos los locales. Con uno solo no aporta nada y no se muestra. */
export default function ResumenGlobal({ totales, cantidadLocales, cantidadAbiertas }) {
  if (cantidadLocales < 2) return null

  return (
    <section className="bg-slate-800 rounded-xl p-4 text-white">
      <h2 className="text-sm font-bold m-0 mb-3 opacity-90">Hoy, sumando tus {cantidadLocales} locales</h2>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-[10px] uppercase opacity-70 font-semibold">Cobros</div>
          <div className="text-lg font-extrabold text-green-400 truncate">{formatCurrency(totales.ventas)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase opacity-70 font-semibold">Gastos</div>
          <div className="text-lg font-extrabold text-red-400 truncate">{formatCurrency(totales.gastos)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase opacity-70 font-semibold">Cajas abiertas</div>
          <div className="text-lg font-extrabold truncate">{cantidadAbiertas} de {cantidadLocales}</div>
        </div>
      </div>
    </section>
  )
}

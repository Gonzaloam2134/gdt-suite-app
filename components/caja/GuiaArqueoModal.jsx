import { useState } from 'react'
import Modal from '../ui/Modal'

const PASOS = [
  {
    icono: '🔓',
    titulo: '1. Al abrir la caja',
    puntos: [
      'Contá el efectivo que hay en el cajón antes de empezar a vender.',
      'Cargá ese número en "Efectivo inicial" al abrir la caja.',
      'Es la base contra la que se compara todo lo demás en el día.',
    ],
  },
  {
    icono: '💰',
    titulo: '2. Durante el día',
    puntos: [
      'Cada cobro y gasto se registra con el botón +Cobro o +Gasto, en el momento en que pasa.',
      '"En caja" muestra el efectivo que debería haber ahora mismo: inicial + cobrado en efectivo − gastado en efectivo.',
      'Si en algún momento contás el cajón y no coincide con "En caja", ahí mismo podés revisar los últimos movimientos antes de que se acumule el desvío.',
    ],
  },
  {
    icono: '🧮',
    titulo: '3. El arqueo (contar antes de cerrar)',
    puntos: [
      'Contá todo el efectivo físico del cajón: billetes y monedas, separados por tipo si te ayuda a no perderte.',
      'Sumalo todo. Ese es el número que vas a cargar como "efectivo contado" al cerrar.',
      'Hacelo siempre, aunque tengas apuro: es lo único que te dice si hay un error o un faltante real, no solo lo que el sistema calcula.',
    ],
  },
  {
    icono: '🔒',
    titulo: '4. Cerrar la caja',
    puntos: [
      'Apretá "Cerrar caja". Vas a ver el resumen del día: inicial, cobros, gastos, y el efectivo esperado.',
      'Cargá el efectivo que contaste en el paso anterior.',
      'El sistema te muestra la diferencia: si cuadra, si falta o si sobra.',
    ],
  },
  {
    icono: '⚖️',
    titulo: '5. Si no cuadra',
    puntos: [
      'Un desvío chico y ocasional es normal: vueltos, redondeos.',
      'Si falta seguido o el monto es grande, revisá: ¿se registraron todos los cobros y gastos del día? ¿Se pagó algo en efectivo sin cargarlo?',
      'Podés dejarlo anotado en "Observaciones" al cerrar, así queda el registro para revisarlo después.',
      'Cerrar con diferencia no rompe nada: el número queda guardado tal como es, para que sea información real y no una caja "forzada" a cuadrar.',
    ],
  },
]

/**
 * Guía siempre accesible desde el botón Ayuda de la caja.
 * No reemplaza el soporte: al final ofrece contactar si la duda persiste.
 */
export default function GuiaArqueoModal({ isOpen, onClose, onContactar }) {
  const [paso, setPaso] = useState(0)
  const actual = PASOS[paso]
  const esUltimo = paso === PASOS.length - 1

  const cerrar = () => { setPaso(0); onClose() }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} size="lg"
      title={`${actual.icono} ${actual.titulo}`}
      subtitle={`Paso ${paso + 1} de ${PASOS.length}`}
      headerClassName="bg-slate-800 text-white"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <button onClick={() => setPaso(p => Math.max(0, p - 1))} disabled={paso === 0}
            className="px-4 py-2 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">
            ← Anterior
          </button>
          <div className="flex gap-1.5">
            {PASOS.map((_, i) => (
              <span key={i} className={`w-2 h-2 rounded-full ${i === paso ? 'bg-blue-500' : 'bg-gray-200'}`} />
            ))}
          </div>
          {esUltimo ? (
            <button onClick={cerrar}
              className="px-4 py-2 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">
              Listo
            </button>
          ) : (
            <button onClick={() => setPaso(p => Math.min(PASOS.length - 1, p + 1))}
              className="px-4 py-2 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">
              Siguiente →
            </button>
          )}
        </div>
      }>
      <ul className="space-y-3 m-0 pl-0 list-none">
        {actual.puntos.map((p, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
            <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold mt-0.5">
              {i + 1}
            </span>
            {p}
          </li>
        ))}
      </ul>

      {esUltimo && onContactar && (
        <div className="mt-5 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500 m-0 mb-2">¿Seguís con dudas?</p>
          <button onClick={onContactar}
            className="text-sm text-blue-600 font-semibold bg-transparent border-none cursor-pointer hover:underline">
            Escribinos una consulta
          </button>
        </div>
      )}
    </Modal>
  )
}

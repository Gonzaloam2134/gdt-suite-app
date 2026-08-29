import Modal from './ui/Modal'
import { ROLES } from '../lib/constants/roles'

const CONTENIDO = {
  [ROLES.OWNER]: {
    titulo: '👋 Bienvenido a GDT Suite',
    proposito: 'Es el control diario de tu caja: sabés en todo momento cuánto entró, cuánto salió y cuánto tenés en mano — sin sumar nada a mano.',
    rol: 'Como dueño, ves todo: la caja de hoy, los reportes para tu contador, y podés sumar gente a tu equipo desde Admin.',
    pasos: [
      'Abrís la caja con el efectivo que tenés al empezar el día.',
      'Cada cobro o gasto se carga al momento, con +Cobro o +Gasto.',
      'Al cerrar, contás el efectivo real y el sistema te dice si cuadra.',
      'Cuando lo necesites, Reportes te arma el resumen (y el PDF/Excel) para tu contador.',
    ],
  },
  [ROLES.CAJERO]: {
    titulo: '👋 Bienvenido, sos cajero',
    proposito: 'Esta app lleva el control de la caja del local, día a día.',
    rol: 'Podés abrir y cerrar la caja, y registrar cada cobro y gasto en el momento en que pasa.',
    pasos: [
      'Al llegar, abrís la caja con el efectivo inicial que te dieron.',
      'Cada venta o gasto, cargalo enseguida — no lo dejes para después.',
      'Al final de tu turno, cerrás la caja y contás el efectivo real.',
    ],
    nota: 'No vas a ver el panel de Admin ni otros locales: solo la caja de hoy.',
  },
  [ROLES.EMPLEADO]: {
    titulo: '👋 Bienvenido al equipo',
    proposito: 'Esta app lleva el control de la caja del local, día a día.',
    rol: 'Podés ver cómo viene el día. Cargar cobros, gastos y cerrar la caja lo hacen el dueño y los cajeros.',
    pasos: [
      'Entrá cuando quieras ver los números del día.',
      'En Admin → "Mi actividad" vas a encontrar el registro de lo que hiciste vos en el sistema.',
    ],
  },
}

/**
 * Se muestra una sola vez por persona, la primera vez que llega a la caja
 * (perfiles.bienvenida_vista_en). El contenido depende del rol porque cada
 * uno puede hacer cosas distintas — prometerle a un empleado que puede cerrar
 * la caja sería mentirle sobre lo que va a encontrar.
 */
export default function BienvenidaModal({ isOpen, onClose, rol }) {
  const c = CONTENIDO[rol] || CONTENIDO[ROLES.EMPLEADO]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={c.titulo} size="md"
      headerClassName="bg-slate-800 text-white"
      footer={<button onClick={onClose}
        className="w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">
        Entendido, vamos
      </button>}>
      <p className="text-sm text-gray-700 m-0">{c.proposito}</p>
      <p className="text-sm text-gray-700 mt-3 m-0"><strong>Tu rol:</strong> {c.rol}</p>

      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-xs font-semibold text-gray-500 uppercase m-0 mb-2">Un día típico</p>
        <ol className="space-y-1.5 m-0 pl-4 text-sm text-gray-700">
          {c.pasos.map((paso, i) => <li key={i}>{paso}</li>)}
        </ol>
      </div>

      {c.nota && <p className="text-xs text-gray-400 mt-3 m-0">{c.nota}</p>}
    </Modal>
  )
}

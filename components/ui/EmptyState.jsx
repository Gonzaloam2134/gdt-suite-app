import Icono, { tieneIcono } from './Icono'

export default function EmptyState({ icono = 'vacio', titulo, descripcion, accion }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-4xl mb-2 text-primary-600/70 flex justify-center">{tieneIcono(icono) ? <Icono nombre={icono} size={44} /> : icono}</div>
      <p className="font-semibold text-gray-800 m-0">{titulo}</p>
      {descripcion && <p className="text-sm text-gray-500 mt-1 m-0">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  )
}

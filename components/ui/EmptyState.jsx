export default function EmptyState({ icono = '📭', titulo, descripcion, accion }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-4xl mb-2">{icono}</div>
      <p className="font-semibold text-gray-800 m-0">{titulo}</p>
      {descripcion && <p className="text-sm text-gray-500 mt-1 m-0">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  )
}

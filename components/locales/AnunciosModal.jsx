import Modal from '../ui/Modal'
import { formatFecha } from '../../lib/format'

const ESTILO = {
  warning: { color: 'bg-amber-500 text-white', icono: '⚠️' },
  success: { color: 'bg-green-600 text-white', icono: '✅' },
  feature: { color: 'bg-purple-600 text-white', icono: '🚀' },
  urgent:  { color: 'bg-red-600 text-white', icono: '🚨' },
  info:    { color: 'bg-primary-700 text-white', icono: 'ℹ️' },
}

/** Novedades sin leer, una por una. Al cerrarlas quedan marcadas en la base. */
export default function AnunciosModal({ anuncios, indice, onSiguiente, onCerrar }) {
  const anuncio = anuncios[indice]
  if (!anuncio) return null
  const estilo = ESTILO[anuncio.tipo] || ESTILO.info
  const esUltimo = indice >= anuncios.length - 1

  return (
    <Modal isOpen onClose={onCerrar} size="lg"
      title={`${estilo.icono} ${anuncio.titulo}`}
      subtitle={anuncios.length > 1 ? `Novedad ${indice + 1} de ${anuncios.length}` : null}
      headerClassName={estilo.color}
      footer={
        <button onClick={esUltimo ? onCerrar : onSiguiente}
          className="px-5 py-2.5 press bg-primary-600 text-white border-none rounded-[14px] text-sm font-bold cursor-pointer hover:bg-primary-700">
          {esUltimo ? 'Entendido' : 'Siguiente'}
        </button>
      }>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed m-0">{anuncio.mensaje}</p>
      <p className="text-xs text-gray-400 mt-4 m-0">Publicado el {formatFecha(anuncio.creado_en)}</p>
    </Modal>
  )
}

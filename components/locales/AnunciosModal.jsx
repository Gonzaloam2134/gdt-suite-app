import Modal from '../ui/Modal'
import Icono, { iconoDeAnuncio } from '../ui/Icono'
import { formatFecha } from '../../lib/format'

// Color del ícono según el tipo de aviso
const TONO = {
  warning: 'text-warning-600',
  urgent: 'text-danger-600',
  success: 'text-primary-600',
  feature: 'text-primary-600',
  info: 'text-gray-500',
}

/** Novedades sin leer, una por una. Al cerrarlas quedan marcadas en la base. */
export default function AnunciosModal({ anuncios, indice, onSiguiente, onCerrar }) {
  const anuncio = anuncios[indice]
  if (!anuncio) return null
  const tono = TONO[anuncio.tipo] || TONO.info
  const esUltimo = indice >= anuncios.length - 1

  return (
    <Modal isOpen onClose={onCerrar} size="lg"
      title={<span className="inline-flex items-center gap-2.5"><span className={tono}><Icono nombre={iconoDeAnuncio(anuncio.tipo)} size={24} /></span>{anuncio.titulo}</span>}
      subtitle={anuncios.length > 1 ? `Novedad ${indice + 1} de ${anuncios.length}` : null}
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

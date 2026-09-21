/**
 * Renderer minimalista para el subset de markdown que usa
 * TERMINOS_Y_CONDICIONES.md (#, ##, **negrita**, *cursiva*, listas "- ",
 * párrafos). No es un parser de markdown general — alcanza con lo que hay en
 * ese documento, sin sumar una librería para esto solo.
 */
function renderInline(texto, keyBase) {
  const partes = texto.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)
  return partes.map((parte, i) => {
    if (parte.startsWith('**') && parte.endsWith('**')) {
      return <strong key={`${keyBase}-${i}`}>{parte.slice(2, -2)}</strong>
    }
    if (parte.startsWith('*') && parte.endsWith('*')) {
      return <em key={`${keyBase}-${i}`}>{parte.slice(1, -1)}</em>
    }
    return parte
  })
}

export default function TerminosContenido({ texto }) {
  const lineas = texto.split('\n')
  const bloques = []
  let itemsLista = null

  const cerrarLista = () => {
    if (itemsLista) { bloques.push(<ul key={`ul-${bloques.length}`} className="list-disc pl-5 space-y-1 my-2">{itemsLista}</ul>); itemsLista = null }
  }

  lineas.forEach((linea, i) => {
    const l = linea.trim()
    if (!l) { cerrarLista(); return }

    if (l.startsWith('## ')) {
      cerrarLista()
      bloques.push(<h2 key={i} className="text-base font-bold text-gray-900 mt-6 mb-2">{renderInline(l.slice(3), i)}</h2>)
    } else if (l.startsWith('# ')) {
      cerrarLista()
      bloques.push(<h1 key={i} className="text-xl font-extrabold text-gray-900 mb-2">{renderInline(l.slice(2), i)}</h1>)
    } else if (l.startsWith('- ')) {
      if (!itemsLista) itemsLista = []
      itemsLista.push(<li key={i}>{renderInline(l.slice(2), i)}</li>)
    } else {
      cerrarLista()
      bloques.push(<p key={i} className="text-sm text-gray-700 leading-relaxed my-2">{renderInline(l, i)}</p>)
    }
  })
  cerrarLista()

  return <div>{bloques}</div>
}

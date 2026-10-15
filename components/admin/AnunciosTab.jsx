import React from 'react'
import Icono, { iconoDeAnuncio } from '../ui/Icono'

export default function AnunciosTab({
  anuncios,
  nuevoAnuncio, setNuevoAnuncio,
  editandoAnuncio, setEditandoAnuncio, guardandoEdicion,
  aEliminarAnuncio, setAEliminarAnuncio, publicando,
  handleCrearAnuncio, handleGuardarEdicion, handleToggleActivo, handleEliminarAnuncio
}) {
  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-500/30 rounded-lg p-4">
        <p className="text-sm text-primary-700 m-0">
          <Icono nombre="novedades" size={16} className="inline-block align-text-bottom mr-1.5 " />Publicá anuncios que todos los usuarios verán al iniciar sesión.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4">Crear nuevo anuncio</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Título:</label>
            <input
              type="text"
              value={nuevoAnuncio.titulo}
              onChange={(e) => setNuevoAnuncio({...nuevoAnuncio, titulo: e.target.value})}
              placeholder="Ej: Nueva funcionalidad disponible"
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Mensaje:</label>
            <textarea
              value={nuevoAnuncio.mensaje}
              onChange={(e) => setNuevoAnuncio({...nuevoAnuncio, mensaje: e.target.value})}
              placeholder="Escribí el mensaje del anuncio..."
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 outline-none resize-vertical"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">Tipo: <span className="text-primary-600"><Icono nombre={iconoDeAnuncio(nuevoAnuncio.tipo)} size={18} /></span></label>
            <select
              value={nuevoAnuncio.tipo}
              onChange={(e) => setNuevoAnuncio({...nuevoAnuncio, tipo: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 outline-none"
            >
              <option value="info">Información</option>
              <option value="warning">Advertencia</option>
              <option value="success">Éxito</option>
              <option value="feature">Nueva feature</option>
            </select>
          </div>

          <button
            onClick={handleCrearAnuncio}
            disabled={publicando}
            className="px-6 py-3 bg-green-500 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-green-600 disabled:opacity-50"
          >
            {publicando ? 'Publicando…' : 'Publicar anuncio'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-bold text-gray-900">Anuncios publicados ({anuncios.length})</h3>
        {anuncios.map(anuncio => (
          <div key={anuncio.id} className={`bg-white rounded-lg border p-4 ${anuncio.activo ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
            {editandoAnuncio?.id === anuncio.id ? (
              <div className="space-y-3">
                <input type="text" value={editandoAnuncio.titulo}
                  onChange={(e) => setEditandoAnuncio({ ...editandoAnuncio, titulo: e.target.value })}
                  placeholder="Título" className="w-full p-2 border border-gray-300 rounded-md text-sm" />
                <textarea value={editandoAnuncio.mensaje} rows={3}
                  onChange={(e) => setEditandoAnuncio({ ...editandoAnuncio, mensaje: e.target.value })}
                  placeholder="Mensaje" className="w-full p-2 border border-gray-300 rounded-md text-sm resize-vertical" />
                <select value={editandoAnuncio.tipo}
                  onChange={(e) => setEditandoAnuncio({ ...editandoAnuncio, tipo: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm">
                  <option value="info">Info</option>
                  <option value="warning">Advertencia</option>
                  <option value="success">Éxito</option>
                  <option value="feature">Novedad</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={handleGuardarEdicion} disabled={guardandoEdicion}
                    className="px-4 py-2 press bg-primary-600 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-primary-700 disabled:opacity-50">
                    {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button onClick={() => setEditandoAnuncio(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="text-primary-600 shrink-0"><Icono nombre={iconoDeAnuncio(anuncio.tipo)} size={26} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 text-sm mb-1 m-0">{anuncio.titulo}</h4>
                    {!anuncio.activo && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-bold uppercase">Oculto</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{anuncio.mensaje}</p>
                  <div className="text-xs text-gray-500 mt-2">
                    Publicado: {new Date(anuncio.creado_en).toLocaleString('es-AR')}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setEditandoAnuncio({ id: anuncio.id, titulo: anuncio.titulo, mensaje: anuncio.mensaje, tipo: anuncio.tipo })}
                      className="px-3 py-1 bg-primary-50 text-primary-700 rounded text-xs font-semibold cursor-pointer hover:bg-primary-500/20">
                      Editar
                    </button>
                    <button onClick={() => handleToggleActivo(anuncio)}
                      className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold cursor-pointer hover:bg-amber-200">
                      {anuncio.activo ? 'Ocultar' : 'Reactivar'}
                    </button>
                    <button onClick={() => setAEliminarAnuncio(anuncio)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold cursor-pointer hover:bg-red-200">
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {anuncios.length === 0 && (
          <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
            <div className="mb-2 text-primary-600/70 flex justify-center"><Icono nombre="vacio" size={40} /></div>
            <p className="text-gray-500 text-sm">No hay anuncios publicados</p>
          </div>
        )}
      </div>
    </div>
  )
}

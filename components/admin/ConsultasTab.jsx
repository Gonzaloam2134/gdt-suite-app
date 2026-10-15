import React from 'react'
import Icono from '../ui/Icono'

export default function ConsultasTab({
  contactos,
  filtroEstado,
  setFiltroEstado,
  respondiendoId,
  setRespondiendoId,
  respuestaTexto,
  setRespuestaTexto,
  handleResponderContacto
}) {
  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-500 opacity-30 rounded-lg p-4">
        <p className="text-sm text-primary-700 m-0">
          <Icono nombre="mail" size={16} className="inline-block align-text-bottom mr-1.5 " />Tenés <strong>{contactos.filter(c => c.estado === 'pendiente').length}</strong> consultas pendientes de {contactos.length} totales.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['todos', 'pendiente', 'resuelto', 'cerrado'].map(estado => (
          <button
            key={estado}
            onClick={() => setFiltroEstado(estado)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none ${
              filtroEstado === estado
                ? 'press bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {estado === 'todos' ? 'Todas' : estado.charAt(0).toUpperCase() + estado.slice(1)}
            {estado !== 'todos' && ` (${contactos.filter(c => c.estado === estado).length})`}
          </button>
        ))}
      </div>

      {contactos
        .filter(c => filtroEstado === 'todos' || c.estado === filtroEstado)
        .map(contacto => {
          const esPendiente = contacto.estado === 'pendiente'
          const esResuelto = contacto.estado === 'resuelto'
          const estaRespondiendo = respondiendoId === contacto.id

          return (
            <div key={contacto.id} className={`bg-white rounded-lg border-2 p-4 ${
              esPendiente ? 'border-amber-300' : esResuelto ? 'border-green-300' : 'border-gray-200'
            }`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      contacto.tipo_consulta === 'soporte' ? 'bg-red-100 text-red-700' :
                      contacto.tipo_consulta === 'feature' ? 'bg-purple-100 text-purple-700' :
                      contacto.tipo_consulta === 'facturacion' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {contacto.tipo_consulta?.toUpperCase() || 'GENERAL'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      esPendiente ? 'bg-amber-100 text-amber-700' :
                      esResuelto ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {contacto.estado.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm mb-1">{contacto.asunto}</h4>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div><Icono nombre="cuenta" size={16} className="inline-block align-text-bottom mr-1.5 " />{contacto.perfil?.email || 'Usuario desconocido'}</div>
                    {contacto.local?.nombre && <div><Icono nombre="inicio" size={16} className="inline-block align-text-bottom mr-1.5 " />{contacto.local.nombre}</div>}
                    <div>Desde: {contacto.pagina_origen || 'Web'}</div>
                    <div><Icono nombre="reloj" size={16} className="inline-block align-text-bottom mr-1.5 " />{new Date(contacto.creado_en).toLocaleString('es-AR')}</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm text-gray-700 whitespace-pre-wrap">
                {contacto.mensaje}
              </div>

              {contacto.respuesta && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                  <div className="text-xs text-green-700 font-bold mb-1"><Icono nombre="check" size={16} className="inline-block align-text-bottom mr-1.5 " />RESPUESTA:</div>
                  <div className="text-sm text-green-900 whitespace-pre-wrap">{contacto.respuesta}</div>
                  {contacto.respondido_en && (
                    <div className="text-xs text-green-600 mt-1">
                      Respondido: {new Date(contacto.respondido_en).toLocaleString('es-AR')}
                    </div>
                  )}
                </div>
              )}

              {esPendiente && !estaRespondiendo && (
                <button
                  onClick={() => setRespondiendoId(contacto.id)}
                  className="px-4 py-2 press bg-primary-600 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-primary-700"
                >
                  Responder
                </button>
              )}

              {estaRespondiendo && (
                <div className="space-y-2">
                  <textarea
                    value={respuestaTexto}
                    onChange={(e) => setRespuestaTexto(e.target.value)}
                    placeholder="Escribí tu respuesta..."
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 outline-none resize-vertical"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResponderContacto(contacto.id)}
                      className="px-4 py-2 bg-green-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-green-600"
                    >
                      Enviar respuesta
                    </button>
                    <button
                      onClick={() => { setRespondiendoId(null); setRespuestaTexto('') }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      }

      {contactos.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="mb-3 text-primary-600/70 flex justify-center"><Icono nombre="vacio" size={44} /></div>
          <p className="text-gray-500 text-sm">No hay consultas de soporte aún.</p>
        </div>
      )}
    </div>
  )
}

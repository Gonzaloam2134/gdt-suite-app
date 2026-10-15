import React from 'react'
import Icono from '../ui/Icono'

export default function LocalesTab({
  todosLosLocales,
  suscripciones,
  filtroLocal,
  setFiltroLocal,
  confirmarLocal,
  setConfirmarLocal
}) {
  const filteredLocales = todosLosLocales.filter(l =>
    l.nombre.toLowerCase().includes(filtroLocal.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-500 opacity-30 rounded-lg p-4">
        <p className="text-sm text-primary-700 m-0">
          <Icono nombre="inicio" size={16} className="inline-block align-text-bottom mr-1.5" />
          Gestioná todos los locales de la plataforma. Podés suspender locales problemáticos.
        </p>
      </div>

      <input
        type="text"
        placeholder="Buscar local por nombre..."
        value={filtroLocal}
        onChange={(e) => setFiltroLocal(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 outline-none"
      />

      <div className="space-y-2">
        {filteredLocales.map(local => {
          const miembrosActivos = local.miembros_locales?.filter(m => m.activo !== false).length || 0;
          const estadoSuscripcion = suscripciones.find(s => s.local_id === local.id)?.estado || 'active';
          const estaSuspendido = estadoSuscripcion === 'suspended';

          return (
            <div key={local.id} className={`bg-white rounded-lg border-2 p-4 ${estaSuspendido ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-bold text-gray-900 text-sm">{local.nombre}</div>
                    {estaSuspendido && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">SUSPENDIDO</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div>Rubro: {local.rubro || 'Sin rubro'}</div>
                    <div>Condición fiscal: {local.condicion_fiscal || 'Sin especificar'}</div>
                    <div>
                      <Icono nombre="reloj" size={16} className="inline-block align-text-bottom mr-1.5" />
                      Creado: {new Date(local.creado_en).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                </div>
              </div>

              {local.miembros_locales && local.miembros_locales.length > 0 && (
                <div className="mb-3 text-xs text-gray-600">
                  <div className="font-semibold mb-1">
                    <Icono nombre="equipo" size={16} className="inline-block align-text-bottom mr-1.5" />
                    Miembros ({miembrosActivos} activos):
                  </div>
                  {local.miembros_locales.slice(0, 5).map((m, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span>{m.perfiles?.email || 'Usuario'}</span>
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{m.rol.toUpperCase()}</span>
                      {m.activo === false && <span className="text-red-600 text-xs">(inactivo)</span>}
                    </div>
                  ))}
                  {local.miembros_locales.length > 5 && (
                    <div className="text-gray-400">... y {local.miembros_locales.length - 5} más</div>
                  )}
                </div>
              )}

              <button
                onClick={() => setConfirmarLocal({ id: local.id, nombre: local.nombre, suspendido: estaSuspendido })}
                className={`px-4 py-2 rounded-md text-xs font-semibold cursor-pointer ${estaSuspendido ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-red-500 text-white hover:bg-red-600'}`}
              >
                {estaSuspendido ? 'Activar local' : 'Suspender local'}
              </button>
            </div>
          );
        })}
      </div>

      {filteredLocales.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="mb-3 text-primary-600 opacity-70 flex justify-center">
            <Icono nombre="buscar" size={44} />
          </div>
          <p className="text-gray-500 text-sm">No se encontraron locales.</p>
        </div>
      )}
    </div>
  );
}

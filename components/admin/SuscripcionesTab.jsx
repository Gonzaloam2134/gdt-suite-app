import React from 'react'
import Icono from '../ui/Icono'

export default function SuscripcionesTab({
  suscripciones,
  filtroSuscripcion, setFiltroSuscripcion,
  confirmarSuscripcion, setConfirmarSuscripcion
}) {
  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-500 opacity-30 rounded-lg p-4">
        <p className="text-sm text-primary-700 m-0">
          <Icono nombre="tarjeta" size={16} className="inline-block align-text-bottom mr-1.5 " />Gestioná el estado de pago de cada local. Podés restringir funcionalidades o suspender el acceso si no pagan.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['todos', 'active', 'restricted', 'suspended'].map(estado => (
          <button
            key={estado}
            onClick={() => setFiltroSuscripcion(estado)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none ${
              filtroSuscripcion === estado
                ? 'press bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {estado === 'todos' ? 'Todos' : <span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${estado === 'active' ? 'bg-green-500' : estado === 'restricted' ? 'bg-amber-500' : 'bg-red-500'}`} />{estado === 'active' ? 'Activos' : estado === 'restricted' ? 'Restringidos' : 'Suspendidos'}</span>}
            {estado !== 'todos' && ` (${suscripciones.filter(s => s.estado === estado).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {suscripciones
          .filter(s => filtroSuscripcion === 'todos' || s.estado === filtroSuscripcion)
          .map(sub => {
            const isVencido = sub.fecha_vencimiento && new Date(sub.fecha_vencimiento) < new Date()

            return (
              <div key={sub.id} className={`bg-white rounded-lg border-2 p-4 ${
                sub.estado === 'active' ? 'border-green-200' :
                sub.estado === 'restricted' ? 'border-amber-200 bg-amber-50' :
                'border-red-200 bg-red-50'
              }`}>
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-gray-900">
                        {sub.locales?.[0]?.nombre || 'Sin local'}
                        {sub.cantidadLocales > 1 && <span className="text-gray-400 font-normal"> +{sub.cantidadLocales - 1} más</span>}
                      </h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        sub.estado === 'active' ? 'bg-green-100 text-green-700' :
                        sub.estado === 'restricted' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {sub.estado === 'active' ? 'ACTIVO' : sub.estado === 'restricted' ? 'RESTRINGIDO (Solo lectura)' : 'SUSPENDIDO'}
                      </span>
                      {isVencido && sub.estado === 'active' && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">VENCIDO</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div><Icono nombre="cuenta" size={16} className="inline-block align-text-bottom mr-1.5 " />Owner: {sub.ownerEmail}</div>
                      <div>
                        Plan: <span className="font-semibold uppercase">{sub.plan}</span>
                      </div>
                      <div>Vencimiento: {sub.fecha_vencimiento ? new Date(sub.fecha_vencimiento).toLocaleDateString('es-AR') : 'Sin fecha'}</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[200px]">
                    {sub.estado !== 'active' && (
                      <button
                        onClick={() => setConfirmarSuscripcion({ ownerId: sub.owner_id, nombreLocal: sub.locales?.[0]?.nombre, nuevoEstado: 'active' })}
                        className="px-3 py-2 bg-green-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-green-600"
                      >
                        Activar / Desbloquear
                      </button>
                    )}
                    {sub.estado !== 'restricted' && (
                      <button
                        onClick={() => setConfirmarSuscripcion({ ownerId: sub.owner_id, nombreLocal: sub.locales?.[0]?.nombre, nuevoEstado: 'restricted' })}
                        className="px-3 py-2 bg-amber-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-amber-600"
                      >
                        Restringir (solo Reportes)
                      </button>
                    )}
                    {sub.estado !== 'suspended' && (
                      <button
                        onClick={() => setConfirmarSuscripcion({ ownerId: sub.owner_id, nombreLocal: sub.locales?.[0]?.nombre, nuevoEstado: 'suspended' })}
                        className="px-3 py-2 bg-red-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-red-600"
                      >
                        Suspender acceso total
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

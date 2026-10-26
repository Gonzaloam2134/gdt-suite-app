import React from 'react'
import Icono from '../ui/Icono'
import { formatCurrency } from '../../lib/format'

export default function ConfiguracionTab({
  config, setConfig,
  handleGuardarConfig,
  planes,
  preciosEditando, setPreciosEditando, guardandoPrecio, handleGuardarPrecio,
  auditoriaGlobal
}) {
  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-500 opacity-30 rounded-lg p-4">
        <p className="text-sm text-primary-700 m-0">
          <Icono nombre="admin" size={16} className="inline-block align-text-bottom mr-1.5 " />Configuración global de la plataforma. Estos valores afectan a todos los usuarios y locales.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4">Parámetros globales</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Máximo de locales por usuario:</label>
            <input
              type="number"
              value={config.max_locales_por_usuario}
              onChange={(e) => setConfig({...config, max_locales_por_usuario: parseInt(e.target.value) || 0})}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Comisión por defecto (%):</label>
            <input
              type="number"
              step="0.1"
              value={config.comision_default}
              onChange={(e) => setConfig({...config, comision_default: parseFloat(e.target.value) || 0})}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Plazo de acreditación default (días):</label>
            <input
              type="number"
              value={config.plazo_acreditacion_default}
              onChange={(e) => setConfig({...config, plazo_acreditacion_default: parseInt(e.target.value) || 0})}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Modo mantenimiento:</label>
            <select
              value={config.mantenimiento_activo ? 'si' : 'no'}
              onChange={(e) => setConfig({...config, mantenimiento_activo: e.target.value === 'si'})}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 outline-none"
            >
              <option value="no">Desactivado</option>
              <option value="si">Activado (bloquea accesos)</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleGuardarConfig}
          className="px-6 py-3 press bg-primary-600 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-primary-700"
        >
          Guardar configuración
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-1">Precios de los planes</h3>
        <p className="text-xs text-gray-500 mb-4">
          Cada fila se guarda por separado. Un cambio acá solo afecta a las
          suscripciones NUEVAS que se creen a partir de ahora — nunca a las
          que ya están activas, esas quedan con el precio que pagaron.
        </p>
        <div className="space-y-2">
          {planes.map(plan => {
            const valorEditando = preciosEditando[plan.id] ?? String(plan.precio)
            const cambio = Number(valorEditando) !== Number(plan.precio)
            return (
              <div key={plan.id} className="flex items-center gap-3 flex-wrap p-3 bg-slate-50 rounded-lg">
                <div className="min-w-[160px]">
                  <div className="text-sm font-semibold text-gray-800">{plan.segmento}</div>
                  <div className="text-xs text-gray-500">{plan.ciclo} · hoy: {formatCurrency(plan.precio)}</div>
                </div>
                <input type="number" min="0" step="100"
                  value={valorEditando}
                  onChange={(e) => setPreciosEditando({ ...preciosEditando, [plan.id]: e.target.value })}
                  className="w-32 p-2 border border-gray-300 rounded-md text-sm" />
                <button
                  onClick={() => handleGuardarPrecio(plan)}
                  disabled={!cambio || guardandoPrecio === plan.id}
                  className="px-3 py-2 bg-green-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {guardandoPrecio === plan.id ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            )
          })}
          {planes.length === 0 && (
            <p className="text-sm text-gray-400 m-0">No se pudieron cargar los planes.</p>
          )}
        </div>
      </div>

      <details className="bg-white rounded-lg border border-gray-200 p-6">
        <summary className="text-base font-bold text-gray-900 cursor-pointer m-0">
          <Icono nombre="candado" size={16} className="inline-block align-text-bottom mr-1.5 " />Auditoría de acciones globales ({auditoriaGlobal.length})
        </summary>
        <p className="text-xs text-gray-500 mt-2 mb-4">
          Registro de acciones sensibles de superadmin que no pertenecen a ningún
          local en particular — hoy, únicamente cambios de email de acceso.
        </p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {auditoriaGlobal.map(log => (
            <div key={log.id} className="p-3 bg-slate-50 rounded-lg text-xs">
              <div className="font-semibold text-gray-800">
                {log.accion === 'email_actualizado' ? 'Email de acceso actualizado' : log.accion}
              </div>
              <div className="text-gray-600 mt-1">
                {log.actor?.nombre || log.actor?.email || 'Desconocido'} → {log.objetivo?.nombre || log.objetivo?.email || 'Desconocido'}
              </div>
              {log.detalles?.emailAnterior && (
                <div className="text-gray-400 mt-1">
                  {log.detalles.emailAnterior} → {log.detalles.emailNuevo}
                </div>
              )}
              <div className="text-gray-400 mt-1">{new Date(log.creado_en).toLocaleString('es-AR')}</div>
            </div>
          ))}
          {auditoriaGlobal.length === 0 && (
            <p className="text-sm text-gray-400 m-0">Sin registros todavía.</p>
          )}
        </div>
      </details>
    </div>
  )
}

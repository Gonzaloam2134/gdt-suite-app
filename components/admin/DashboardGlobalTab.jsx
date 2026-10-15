import React from 'react'
import Icono from '../ui/Icono'

export default function DashboardGlobalTab({ globalStats }) {
  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-500 opacity-30 rounded-lg p-4">
        <p className="text-sm text-primary-700 m-0">
          <Icono nombre="corona" size={16} className="inline-block align-text-bottom mr-1.5 " />Bienvenido al panel de super administrador. Acá tenés una vista global de toda la plataforma GDT Suite.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="text-xs text-gray-500 font-semibold mb-2"><Icono nombre="inicio" size={16} className="inline-block align-text-bottom mr-1.5 " />LOCALES REGISTRADOS</div>
          <div className="text-3xl font-extrabold text-primary-700">{globalStats.locales}</div>
          <div className="text-xs text-gray-400 mt-1">Total en la plataforma</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="text-xs text-gray-500 font-semibold mb-2"><Icono nombre="equipo" size={16} className="inline-block align-text-bottom mr-1.5 " />USUARIOS ACTIVOS</div>
          <div className="text-3xl font-extrabold text-green-700">{globalStats.usuarios}</div>
          <div className="text-xs text-gray-400 mt-1">Cuentas registradas</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="text-xs text-gray-500 font-semibold mb-2"><Icono nombre="tarjeta" size={16} className="inline-block align-text-bottom mr-1.5 " />TRANSACCIONES</div>
          <div className="text-3xl font-extrabold text-purple-700">{globalStats.transacciones}</div>
          <div className="text-xs text-gray-400 mt-1">Total procesadas</div>
        </div>
      </div>
    </div>
  )
}

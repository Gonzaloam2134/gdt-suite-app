import { useState } from 'react'

export default function OnboardingEmpleado({ onAdd, onRemove, empleados }) {
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('empleado')

  const handleAgregar = () => {
    if (!nombre.trim()) return
    onAdd({ nombre: nombre.trim(), rol })
    setNombre('')
    setRol('empleado')
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <h3 className="m-0 mb-4 text-lg font-bold text-gray-900">
        👥 Agregar empleados (opcional)
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Podés cargar ahora a tu equipo. Después podrás asociar sus emails desde el panel de administración.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Nombre del empleado"
          className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          onKeyPress={e => e.key === 'Enter' && handleAgregar()}
        />
        <select
          value={rol}
          onChange={e => setRol(e.target.value)}
          className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
        >
          <option value="cajero">👨‍💼 Cajero</option>
          <option value="empleado"> Empleado</option>
        </select>
        <button
          onClick={handleAgregar}
          disabled={!nombre.trim()}
          className="p-3 bg-blue-500 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50 hover:bg-blue-600"
        >
          ➕ Agregar
        </button>
      </div>

      {empleados.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">
            Empleados agregados ({empleados.length})
          </h4>
          {empleados.map((emp, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg">
                  {emp.rol === 'cajero' ? '👨‍💼' : ''}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{emp.nombre}</div>
                  <div className="text-xs text-gray-500">
                    {emp.rol === 'cajero' ? 'Cajero' : 'Empleado'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onRemove(index)}
                className="px-3 py-1 bg-red-100 text-red-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-red-200"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
import React from 'react'
import Icono from '../ui/Icono'

export default function UsuariosTab({
  usuarios,
  editandoUsuario, setEditandoUsuario, nuevoRol, setNuevoRol, handleActualizarUsuario,
  editandoEmail, setEditandoEmail, nuevoEmail, setNuevoEmail, confirmarEmail, setConfirmarEmail, guardandoEmail
}) {
  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-500/30 rounded-lg p-4">
        <p className="text-sm text-primary-700 m-0">
          <Icono nombre="equipo" size={16} className="inline-block align-text-bottom mr-1.5 " />Gestioná los usuarios de la plataforma. Podés cambiar el rol global.
          El email de inicio de sesión se administra desde Supabase Auth, no desde acá.
        </p>
      </div>

      <div className="space-y-2">
        {usuarios.map(usuario => {
          const esActivo = usuario.activo !== false

          return (
            <div key={usuario.id} className={`bg-white rounded-lg border-2 p-4 ${
              esActivo ? 'border-gray-200' : 'border-red-300 bg-red-50'
            }`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-bold text-gray-900 text-sm">{usuario.nombre || 'Sin nombre'}</div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      usuario.rol_global === 'super_user' ? 'bg-purple-100 text-purple-700' :
                      usuario.rol_global === 'owner' ? 'bg-primary-50 text-primary-700' :
                      usuario.rol_global === 'cajero' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {usuario.rol_global?.toUpperCase() || 'USUARIO'}
                    </span>
                    {!esActivo && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">INACTIVO</span>}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">{usuario.email}</div>
                </div>
              </div>

              {editandoUsuario === usuario.id ? (
                <div className="bg-slate-50 p-3 rounded-lg space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Cambiar rol global:</label>
                    <select
                      value={nuevoRol || usuario.rol_global}
                      onChange={(e) => setNuevoRol(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="owner">Owner</option>
                      <option value="cajero">Cajero</option>
                      <option value="empleado">Empleado</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleActualizarUsuario(usuario.id)}
                      className="px-4 py-2 bg-green-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-green-600"
                    >
                      Guardar cambios
                    </button>
                    <button
                      onClick={() => { setEditandoUsuario(null); setNuevoRol('') }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : editandoEmail === usuario.id ? (
                <div className="bg-slate-50 p-3 rounded-lg space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Nuevo email de acceso (también cambia con qué inicia sesión):
                    </label>
                    <input type="email" value={nuevoEmail} autoFocus
                      onChange={(e) => setNuevoEmail(e.target.value)}
                      placeholder={usuario.email}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={!/\S+@\S+\.\S+/.test(nuevoEmail) || nuevoEmail === usuario.email}
                      onClick={() => setConfirmarEmail({ id: usuario.id, emailActual: usuario.email, emailNuevo: nuevoEmail })}
                      className="px-4 py-2 bg-amber-500 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Guardar cambios
                    </button>
                    <button
                      onClick={() => { setEditandoEmail(null); setNuevoEmail('') }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { setEditandoUsuario(usuario.id); setNuevoRol(usuario.rol_global) }}
                    className="px-4 py-2 press bg-primary-600 text-white rounded-md text-xs font-semibold cursor-pointer hover:bg-primary-700"
                  >
                    Editar rol
                  </button>
                  <button
                    onClick={() => { setEditandoEmail(usuario.id); setNuevoEmail(usuario.email || '') }}
                    className="px-4 py-2 bg-amber-100 text-amber-700 rounded-md text-xs font-semibold cursor-pointer hover:bg-amber-200"
                  >
                    Editar email
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

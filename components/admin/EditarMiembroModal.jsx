import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { ROLES_INVITABLES, LABEL_ROL } from '../../lib/constants/roles'

/**
 * Edita el rol del miembro EN ESTE LOCAL y su nombre de perfil.
 * No toca perfiles.rol_global: el rol global es otra cosa y pisarlo degradaba
 * usuarios (incluido un super_user) — era el bug del panel viejo.
 */
export default function EditarMiembroModal({ isOpen, onClose, miembro, onGuardar, procesando }) {
  const [rol, setRol] = useState('')
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    if (!miembro) return
    setRol(miembro.rol)
    setNombre(miembro.perfil?.nombre || '')
  }, [miembro])

  if (!miembro) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar miembro" subtitle={miembro.perfil?.email}
      footer={<>
        <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">Cancelar</button>
        <button onClick={() => onGuardar({ rol, nombre })} disabled={procesando}
          className="px-4 py-2.5 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 disabled:opacity-50">
          {procesando ? 'Guardando…' : 'Guardar'}
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label htmlFor="m-nombre" className="block text-sm font-semibold text-gray-700 mb-2">Nombre</label>
          <input id="m-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label htmlFor="m-rol" className="block text-sm font-semibold text-gray-700 mb-2">Rol en este local</label>
          <select id="m-rol" value={rol} onChange={(e) => setRol(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm">
            {ROLES_INVITABLES.map(r => <option key={r} value={r}>{LABEL_ROL[r]}</option>)}
          </select>
          <p className="text-xs text-gray-500 mt-2 m-0">
            El cajero puede registrar cobros y gastos y operar la caja. El empleado solo ve su propia actividad.
          </p>
        </div>
      </div>
    </Modal>
  )
}

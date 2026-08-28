export const ACCIONES = Object.freeze({
  CAJA_ABIERTA: 'CAJA_ABIERTA',
  CAJA_CERRADA: 'CAJA_CERRADA',
  COBRO_REGISTRADO: 'COBRO_REGISTRADO',
  GASTO_REGISTRADO: 'GASTO_REGISTRADO',
  REVERSA_REGISTRADA: 'REVERSA_REGISTRADA',
  USUARIO_INVITADO: 'USUARIO_INVITADO',
  INVITACION_ACEPTADA: 'INVITACION_ACEPTADA',
  MIEMBRO_QUITADO: 'MIEMBRO_QUITADO',
  MEDIO_PAGO_CREADO: 'MEDIO_PAGO_CREADO',
  MEDIO_PAGO_EDITADO: 'MEDIO_PAGO_EDITADO',
  ROL_CAMBIADO: 'ROL_CAMBIADO',
  LOCAL_CREADO: 'LOCAL_CREADO',
})

const LABELS = {
  CAJA_ABIERTA:       { icono: '🔓', texto: 'Caja abierta',        color: 'bg-blue-100 text-blue-800' },
  CAJA_CERRADA:       { icono: '🔒', texto: 'Caja cerrada',        color: 'bg-gray-100 text-gray-800' },
  COBRO_REGISTRADO:   { icono: '💰', texto: 'Cobro registrado',    color: 'bg-green-100 text-green-800' },
  GASTO_REGISTRADO:   { icono: '💸', texto: 'Gasto registrado',    color: 'bg-red-100 text-red-800' },
  REVERSA_REGISTRADA: { icono: '↩️', texto: 'Reversa',             color: 'bg-orange-100 text-orange-800' },
  USUARIO_INVITADO:   { icono: '✉️', texto: 'Usuario invitado',    color: 'bg-purple-100 text-purple-800' },
  INVITACION_ACEPTADA:{ icono: '✅', texto: 'Invitación aceptada', color: 'bg-emerald-100 text-emerald-800' },
  MIEMBRO_QUITADO:    { icono: '🚫', texto: 'Miembro quitado',     color: 'bg-gray-100 text-gray-800' },
  MEDIO_PAGO_CREADO:  { icono: '💳', texto: 'Medio de pago creado',color: 'bg-amber-100 text-amber-800' },
  MEDIO_PAGO_EDITADO: { icono: '💳', texto: 'Medio de pago editado',color: 'bg-amber-100 text-amber-800' },
  ROL_CAMBIADO:       { icono: '🔄', texto: 'Rol cambiado',        color: 'bg-indigo-100 text-indigo-800' },
  LOCAL_CREADO:       { icono: '🏪', texto: 'Local creado',        color: 'bg-blue-100 text-blue-800' },
}

export const labelAccion = (accion) =>
  LABELS[accion] || { icono: '📝', texto: accion, color: 'bg-gray-100 text-gray-800' }

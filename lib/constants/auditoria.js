export const ACCIONES = Object.freeze({
  CAJA_ABIERTA: 'CAJA_ABIERTA',
  MONTO_INICIAL_CORREGIDO: 'MONTO_INICIAL_CORREGIDO',
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
  CAJA_ABIERTA:       { icono: '🔓', texto: 'Caja abierta',        color: 'bg-primary-50 text-primary-700' },
  MONTO_INICIAL_CORREGIDO: { icono: '✏️', texto: 'Monto inicial corregido', color: 'bg-amber-100 text-amber-800' },
  CAJA_CERRADA:       { icono: 'candado', texto: 'Caja cerrada',        color: 'bg-gray-100 text-gray-800' },
  COBRO_REGISTRADO:   { icono: 'dinero', texto: 'Cobro registrado',    color: 'bg-green-100 text-green-800' },
  GASTO_REGISTRADO:   { icono: '💸', texto: 'Gasto registrado',    color: 'bg-red-100 text-red-800' },
  REVERSA_REGISTRADA: { icono: '↩️', texto: 'Reversa',             color: 'bg-orange-100 text-orange-800' },
  USUARIO_INVITADO:   { icono: 'mail', texto: 'Usuario invitado',    color: 'bg-purple-100 text-purple-800' },
  INVITACION_ACEPTADA:{ icono: 'check', texto: 'Invitación aceptada', color: 'bg-emerald-100 text-emerald-800' },
  MIEMBRO_QUITADO:    { icono: '🚫', texto: 'Miembro quitado',     color: 'bg-gray-100 text-gray-800' },
  MEDIO_PAGO_CREADO:  { icono: 'tarjeta', texto: 'Medio de pago creado',color: 'bg-amber-100 text-amber-800' },
  MEDIO_PAGO_EDITADO: { icono: 'tarjeta', texto: 'Medio de pago editado',color: 'bg-amber-100 text-amber-800' },
  ROL_CAMBIADO:       { icono: '🔄', texto: 'Rol cambiado',        color: 'bg-primary-50 text-primary-700' },
  LOCAL_CREADO:       { icono: 'inicio', texto: 'Local creado',        color: 'bg-primary-50 text-primary-700' },
}

export const labelAccion = (accion) =>
  LABELS[accion] || { icono: '📝', texto: accion, color: 'bg-gray-100 text-gray-800' }

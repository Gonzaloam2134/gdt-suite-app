/** Rol por local (miembros_locales.rol) */
export const ROLES = Object.freeze({
  OWNER: 'owner',
  CAJERO: 'cajero',
  EMPLEADO: 'empleado',
})

/** Rol global (perfiles.rol_global). Solo estos dos valores desde la migración esquema_v2. */
export const ROLES_GLOBALES = Object.freeze({
  SUPER_USER: 'super_user',
  OWNER: 'owner',
})

export const LABEL_ROL = {
  owner: 'Dueño',
  cajero: 'Cajero',
  empleado: 'Empleado',
  super_user: 'Super admin',
}

/** Quién abre/cierra caja, registra gastos, y puede cancelar (anular) movimientos */
export const ROLES_OPERAN_CAJA = [ROLES.OWNER, ROLES.CAJERO]

/**
 * Quién puede registrar un COBRO. Más amplio que ROLES_OPERAN_CAJA a propósito:
 * el empleado (ej. un vendedor de mostrador) carga las ventas del día pero no
 * maneja el cajón — no abre, no cierra, no paga gastos, no cancela nada.
 * Sin esto el rol "empleado" no tiene ninguna tarea real en la app.
 */
export const ROLES_REGISTRAN_COBRO = [ROLES.OWNER, ROLES.CAJERO, ROLES.EMPLEADO]

/** Roles que se pueden asignar por invitación */
export const ROLES_INVITABLES = [ROLES.CAJERO, ROLES.EMPLEADO]

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

/** Quién puede registrar cobros/gastos y abrir/cerrar caja (coincide con RLS tx_insert) */
export const ROLES_OPERAN_CAJA = [ROLES.OWNER, ROLES.CAJERO]

/** Roles que se pueden asignar por invitación */
export const ROLES_INVITABLES = [ROLES.CAJERO, ROLES.EMPLEADO]

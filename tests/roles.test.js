import { describe, it, expect } from 'vitest'
import { ROLES, ROLES_OPERAN_CAJA, ROLES_REGISTRAN_COBRO } from '../lib/constants/roles'

describe('permisos por rol', () => {
  it('solo owner y cajero abren/cierran caja y cargan gastos', () => {
    expect(ROLES_OPERAN_CAJA).toEqual([ROLES.OWNER, ROLES.CAJERO])
    expect(ROLES_OPERAN_CAJA).not.toContain(ROLES.EMPLEADO)
  })

  it('los tres roles pueden registrar un cobro — sin esto, empleado no tiene ninguna tarea', () => {
    expect(ROLES_REGISTRAN_COBRO).toContain(ROLES.OWNER)
    expect(ROLES_REGISTRAN_COBRO).toContain(ROLES.CAJERO)
    expect(ROLES_REGISTRAN_COBRO).toContain(ROLES.EMPLEADO)
  })

  it('registrar cobro es un permiso más amplio que operar la caja entera', () => {
    for (const r of ROLES_OPERAN_CAJA) expect(ROLES_REGISTRAN_COBRO).toContain(r)
  })
})

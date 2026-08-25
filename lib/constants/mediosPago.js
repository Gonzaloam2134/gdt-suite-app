/** Valores válidos de medios_pago.tipo (check constraint medios_pago_tipo_check) */
export const TIPOS_MEDIO = Object.freeze({
  EFECTIVO: 'efectivo',
  DEBITO: 'debito',
  CREDITO: 'credito',
  TRANSFERENCIA: 'transferencia',
  QR: 'qr',
  BILLETERA: 'billetera_virtual',
  OTRO: 'otro',
})

export const LABEL_TIPO_MEDIO = {
  efectivo: 'Efectivo',
  debito: 'Tarjeta de débito',
  credito: 'Tarjeta de crédito',
  transferencia: 'Transferencia',
  qr: 'QR',
  billetera_virtual: 'Billetera virtual',
  otro: 'Otro',
}

export const ICONO_TIPO_MEDIO = {
  efectivo: '💵',
  debito: '💳',
  credito: '💳',
  transferencia: '🏦',
  qr: '📱',
  billetera_virtual: '📱',
  otro: '💰',
}

export const iconoMedio = (tipo) => ICONO_TIPO_MEDIO[tipo] || ICONO_TIPO_MEDIO.otro

/** Medios que dejan efectivo físico en la caja */
export const esEfectivo = (medio) => medio?.tipo === TIPOS_MEDIO.EFECTIVO

/** Medios por defecto que ofrece el onboarding */
export const MEDIOS_DEFAULT = [
  { nombre: 'Efectivo', tipo: 'efectivo', comision: 0, plazo: 0, habilitado: true },
  { nombre: 'Tarjeta de Débito', tipo: 'debito', comision: 0, plazo: 1, habilitado: true },
  { nombre: 'Tarjeta de Crédito', tipo: 'credito', comision: 3.5, plazo: 30, habilitado: true },
  { nombre: 'Transferencia', tipo: 'transferencia', comision: 0, plazo: 0, habilitado: true },
  { nombre: 'Mercado Pago QR', tipo: 'qr', comision: 1.99, plazo: 1, habilitado: false },
]

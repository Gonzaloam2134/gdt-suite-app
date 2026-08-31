/** Segmento de precio: a qué tipo de negocio apunta cada plan. */
export const SEGMENTO = Object.freeze({
  BASICO: 'basico',
  NEGOCIO: 'negocio',
  MULTI_LOCAL: 'multi_local',
})

export const CICLO = Object.freeze({
  MENSUAL: 'mensual',
  ANUAL: 'anual',
})

export const LABEL_SEGMENTO = {
  basico: 'Básico',
  negocio: 'Negocio',
  multi_local: 'Multi-local',
}

export const LABEL_CICLO = { mensual: 'Mensual', anual: 'Anual' }

/**
 * Límite de personas operando (dueño + cajeros + empleados activos) por
 * segmento. null = sin límite. Este es el ÚNICO límite duro del sistema:
 * cantidad de locales nunca se bloquea — cada local nuevo es una venta más,
 * no algo que frenar. "Multi-local" es una tarifa con descuento por local
 * adicional, no una puerta de acceso.
 */
export const LIMITE_EQUIPO = {
  [SEGMENTO.BASICO]: 1,
  [SEGMENTO.NEGOCIO]: null,
  [SEGMENTO.MULTI_LOCAL]: null,
}

export const DESCRIPCION_SEGMENTO = {
  basico: 'Para el que atiende solo: vos operás la caja, sin sumar gente.',
  negocio: 'Para cuando hay equipo: sumá cajeros y empleados sin límite.',
  multi_local: 'Para el que ya tiene más de un local — se aplica automáticamente desde el segundo.',
}

/**
 * Detalle completo por plan, para la vidriera de precios (/planes).
 * Todo lo que aparece acá es una función que YA existe en la app — no es
 * marketing de algo que todavía no se construyó.
 */
export const CARACTERISTICAS_SEGMENTO = {
  basico: [
    'Vos operás la caja: abrís, cerrás, cargás cobros y gastos',
    'Sin cajeros ni empleados — un solo operador por local',
    'Reportes completos para tu contador (PDF y Excel), sin límite',
    'App instalable en el celular, funciona igual que cualquier app',
  ],
  negocio: [
    'Todo lo del plan Básico',
    'Cajeros y empleados sin límite — invitalos por WhatsApp',
    'Cajero: abre/cierra caja, carga cobros y gastos',
    'Empleado: carga cobros de sus ventas',
    'Auditoría de quién hizo cada movimiento',
  ],
  multi_local: [
    'Todo lo del plan Negocio',
    'Se aplica automáticamente al segundo local y siguientes',
    'Reportes consolidados de todos tus locales juntos',
    'Cada local con su propio equipo y su propia caja',
  ],
}

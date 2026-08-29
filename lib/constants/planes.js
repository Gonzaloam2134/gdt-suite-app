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
  multi_local: 'Para cadenas: precio con descuento por cada local además del primero.',
}

/**
 * La suscripción es POR CUENTA (el dueño), no por local: paga UNA vez y
 * cubre todos los locales que tenga. Multi-local es el tope de todo, sin
 * límite de equipo ni de locales — Básico y Negocio están atados a un
 * único local (se sube de plan para abrir el segundo, nunca se bloquea
 * sin salida: el mensaje siempre lleva a /planes).
 */
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

/** Personas operando (dueño + cajeros + empleados activos) por local. null = sin límite. */
export const LIMITE_EQUIPO = {
  [SEGMENTO.BASICO]: 1,
  [SEGMENTO.NEGOCIO]: null,
  [SEGMENTO.MULTI_LOCAL]: null,
}

/** Locales que puede tener la cuenta. null = sin límite. */
export const LIMITE_LOCALES = {
  [SEGMENTO.BASICO]: 1,
  [SEGMENTO.NEGOCIO]: 1,
  [SEGMENTO.MULTI_LOCAL]: null,
}

export const DESCRIPCION_SEGMENTO = {
  basico: 'Un local, vos solo operando.',
  negocio: 'Un local, con equipo sin límite.',
  multi_local: 'Locales y equipo sin límite — el plan para cadenas.',
}

/**
 * Detalle completo por plan, para la vidriera de precios (/planes).
 * Todo lo que aparece acá es una función que YA existe en la app.
 */
export const CARACTERISTICAS_SEGMENTO = {
  basico: [
    'Un local. Vos operás la caja: abrís, cerrás, cargás cobros y gastos',
    'Sin cajeros ni empleados — un solo operador',
    'Reportes completos para tu contador (PDF y Excel), sin límite',
    'App instalable en el celular',
  ],
  negocio: [
    'Un local. Todo lo del plan Básico',
    'Cajeros y empleados sin límite — invitalos por WhatsApp',
    'Cajero: abre/cierra caja, carga cobros y gastos',
    'Empleado: carga cobros de sus ventas',
    'Auditoría de quién hizo cada movimiento',
  ],
  multi_local: [
    'Todo lo del plan Negocio, sin límite de locales',
    'Abrí el segundo, tercero, o los que necesites, sin pagar aparte',
    'Reportes consolidados de todos tus locales juntos',
    'Cada local con su propio equipo y su propia caja',
  ],
}

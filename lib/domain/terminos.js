/**
 * Se versiona por fecha, no por un booleano: si `terminos_version` guardado
 * no coincide con la versión vigente (o nunca aceptó ninguna), tiene que
 * volver a aceptar — sin importar que ya hubiera aceptado una versión vieja.
 */
export const debeAceptarTerminos = (versionAceptada, versionActual) =>
  versionAceptada !== versionActual

/**
 * El texto/versión vigentes son editables desde el panel de super admin
 * (`configuracion_global.terminos_texto/terminos_version`), pero mientras esa
 * fila no tenga nada cargado ahí (migración recién corrida, o nunca se editó)
 * se sigue mostrando el texto hardcodeado de lib/constants/legal.js — nunca
 * un texto vacío ni "sin términos".
 */
export const resolverTerminosVigentes = (config, defaults) => ({
  texto: config?.terminos_texto || defaults.texto,
  version: config?.terminos_version || defaults.version,
})

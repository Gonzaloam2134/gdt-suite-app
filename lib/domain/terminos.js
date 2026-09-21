/**
 * Se versiona por fecha, no por un booleano: si `terminos_version` guardado
 * no coincide con la versión vigente (o nunca aceptó ninguna), tiene que
 * volver a aceptar — sin importar que ya hubiera aceptado una versión vieja.
 */
export const debeAceptarTerminos = (versionAceptada, versionActual) =>
  versionAceptada !== versionActual

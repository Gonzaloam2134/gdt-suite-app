/**
 * Lógica de negocio pura sobre el comprobante adjunto a un movimiento.
 * Sin React, sin Supabase. Los límites acá tienen que coincidir con los que
 * se configuraron en el bucket de Storage (MIGRACION_COMPROBANTES.sql) — si
 * uno de los dos cambia, cambiar el otro.
 */

export const TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024 // 8MB

export const TIPOS_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]

const EXTENSION_POR_TIPO = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
}

/**
 * Valida un archivo elegido por la persona antes de subirlo. Devuelve
 * `{ ok: true }` o `{ ok: false, error }` con un mensaje ya en español para
 * mostrar tal cual — nunca tira: el llamador decide qué hacer con el error.
 */
export const validarComprobante = (file) => {
  if (!file) return { ok: false, error: 'No se seleccionó ningún archivo' }

  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return { ok: false, error: 'Formato no admitido. Usá una foto (JPG, PNG, HEIC), WEBP o PDF' }
  }

  if (file.size > TAMANO_MAXIMO_BYTES) {
    return { ok: false, error: 'El archivo pesa más de 8MB. Probá con una foto de menor calidad' }
  }

  return { ok: true }
}

/**
 * Formatos que vale la pena re-comprimir antes de subir: una foto de cámara
 * sin editar pesa varios MB y nadie necesita esa resolución para leer un
 * ticket. PDF se deja igual (ya suele venir liviano, y comprimirlo requiere
 * otra herramienta). HEIC se deja igual también: decodificarlo con
 * `<canvas>` no es confiable en todos los navegadores — mejor subirlo tal
 * cual que arriesgar romper la subida.
 */
export const debeComprimirse = (mimeType) =>
  ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)

/**
 * Construye la ruta dentro del bucket `comprobantes`. El primer segmento
 * tiene que ser el `local_id` tal cual, porque las policies de Storage lo
 * leen con `storage.foldername(name)[1]` para decidir quién puede acceder
 * (ver MIGRACION_COMPROBANTES.sql) — cambiar el orden rompe esas policies.
 */
export const construirRutaComprobante = (localId, transaccionId, mimeType) => {
  const ext = EXTENSION_POR_TIPO[mimeType] || 'bin'
  const unico = Date.now()
  return `${localId}/${transaccionId}-${unico}.${ext}`
}

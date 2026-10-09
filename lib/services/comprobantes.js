import { supabase } from '../supabaseClient'
import { unwrap } from './_base'
import { validarComprobante, construirRutaComprobante, debeComprimirse } from '../domain/comprobantes'

const BUCKET = 'comprobantes'
// Suficiente para que la persona vea la imagen/PDF y la URL ya venció —
// bucket privado, nada de links que sigan funcionando después.
const VIGENCIA_URL_FIRMADA_SEGUNDOS = 60 * 5

// Nadie necesita más resolución que esta para leer un ticket — una foto de
// cámara sin editar suele venir en 3000-4000px de lado y pesar varios MB.
const LADO_MAXIMO_PX = 1600
const CALIDAD_JPEG = 0.72

/**
 * Redimensiona y recomprime una foto a JPEG antes de subirla — client-side,
 * vía <canvas>, sin librería nueva. Si algo falla (navegador raro, imagen
 * corrupta), el llamador tiene que poder seguir con el archivo original en
 * vez de bloquear la subida por esto.
 */
const comprimirImagen = (file, lado = LADO_MAXIMO_PX, calidad = CALIDAD_JPEG) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (!blob) return reject(new Error('No se pudo comprimir la imagen'))
        const nombre = file.name.replace(/\.\w+$/, '') + '.jpg'
        resolve(new File([blob], nombre, { type: 'image/jpeg' }))
      }, 'image/jpeg', calidad)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
    img.src = url
  })

/**
 * Sube el archivo a Storage (directo, client-side — las policies de
 * `storage.objects` ya validan el rol) y después registra la ruta contra el
 * movimiento vía Service Role (ver pages/api/comprobante.js: ese `update()`
 * sobre `transacciones` no pasa por el cliente anon, por el mismo motivo que
 * `aceptarTerminos`/`marcarBienvenidaVista`).
 */
export const subirComprobante = async (transaccionId, localId, file) => {
  const validacion = validarComprobante(file)
  if (!validacion.ok) throw new Error(validacion.error)

  // Si falla la compresión seguimos con el original — más vale un
  // comprobante pesado que uno que no se subió.
  const archivo = debeComprimirse(file.type) ? await comprimirImagen(file).catch(() => file) : file

  const path = construirRutaComprobante(localId, transaccionId, archivo.type)

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(path, archivo, { contentType: archivo.type, upsert: true })
  if (errorSubida) throw new Error(errorSubida.message || 'No se pudo subir el comprobante')

  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/comprobante', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ transaccionId, path }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'No se pudo guardar el comprobante')

  return path
}

/** URL firmada de corta duración para ver/descargar un comprobante ya cargado. */
export const obtenerUrlComprobante = (path) =>
  supabase.storage.from(BUCKET).createSignedUrl(path, VIGENCIA_URL_FIRMADA_SEGUNDOS)
    .then(unwrap)
    .then((data) => data.signedUrl)

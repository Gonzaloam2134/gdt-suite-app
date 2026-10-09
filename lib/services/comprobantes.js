import { supabase } from '../supabaseClient'
import { unwrap } from './_base'
import { validarComprobante, construirRutaComprobante } from '../domain/comprobantes'

const BUCKET = 'comprobantes'
// Suficiente para que la persona vea la imagen/PDF y la URL ya venció —
// bucket privado, nada de links que sigan funcionando después.
const VIGENCIA_URL_FIRMADA_SEGUNDOS = 60 * 5

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

  const path = construirRutaComprobante(localId, transaccionId, file.type)

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true })
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

import { supabaseAdmin } from '../../lib/server/supabaseAdmin'

/**
 * Registra el comprobante que ya se subió a Storage contra el movimiento.
 * La subida del archivo en sí la hace el cliente directo (las lecturas/
 * escrituras de Storage no mostraron el problema de RLS silencioso que sí
 * tienen los `update()` sobre `perfiles` — ver aceptar-terminos.js), pero
 * esta UPDATE sobre `transacciones` pasa por Service Role como precaución:
 * mismo patrón ya confirmado dos veces, para no arriesgar una tercera
 * ocurrencia silenciosa.
 *
 * Service Role salta RLS, así que el chequeo de permisos se hace a mano:
 * quien llama tiene que ser miembro activo (owner o cajero) del local
 * dueño de la transacción — igual que en vincular-local.js.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: { user: quienLlama }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !quienLlama) return res.status(401).json({ error: 'No autenticado' })

  const { transaccionId, path } = req.body || {}
  if (!transaccionId || !path) return res.status(400).json({ error: 'Faltan datos' })

  const { data: transaccion } = await supabaseAdmin
    .from('transacciones').select('id, local_id').eq('id', transaccionId).maybeSingle()
  if (!transaccion) return res.status(404).json({ error: 'Movimiento no encontrado' })

  // El path tiene que vivir en la carpeta del MISMO local de la transacción
  // (primer segmento) — si no coincide, alguien está mandando un path ajeno.
  if (!path.startsWith(`${transaccion.local_id}/`)) {
    return res.status(400).json({ error: 'El comprobante no corresponde a este local' })
  }

  const { data: membresia } = await supabaseAdmin
    .from('miembros_locales').select('rol').eq('local_id', transaccion.local_id).eq('user_id', quienLlama.id).eq('activo', true).maybeSingle()
  if (!['owner', 'cajero'].includes(membresia?.rol)) {
    return res.status(403).json({ error: 'No tenés permiso para adjuntar comprobantes en este local' })
  }

  const { error } = await supabaseAdmin
    .from('transacciones')
    .update({ comprobante_path: path })
    .eq('id', transaccionId)

  if (error) {
    console.error('[api/comprobante]', error)
    return res.status(400).json({ error: 'No se pudo guardar el comprobante' })
  }

  return res.status(200).json({ ok: true, path })
}

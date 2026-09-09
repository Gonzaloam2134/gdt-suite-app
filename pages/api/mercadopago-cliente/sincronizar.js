import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { sincronizarCuenta, VENTANA_SINCRONIZACION_MANUAL_HORAS } from '../../../lib/server/mercadopagoClienteSync'
import { getConexionDeOwner, marcarSincronizacionManual } from '../../../lib/services/conexionesMercadopago'
import { segundosParaProximaSincronizacionManual } from '../../../lib/domain/mercadopagoCliente'

/**
 * "Sincronizar" del dashboard (dueño o cajero, cualquiera de los dos toca
 * el botón): re-consulta la cuenta de Mercado Pago del local al toque, en
 * vez de esperar al cron diario (ver pages/api/cron/mercadopago-cliente-
 * sync.js — Vercel Hobby no admite algo más frecuente). Usa la misma
 * sincronizarCuenta que el webhook y el backfill, así que es idempotente:
 * tocar el botón dos veces no duplica nada.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'No autenticado' })

  const { localId } = req.body || {}
  if (!localId) return res.status(400).json({ error: 'Falta el local' })

  const { data: membresia } = await supabaseAdmin
    .from('miembros_locales').select('rol').eq('local_id', localId).eq('user_id', user.id).eq('activo', true).maybeSingle()
  if (!membresia) return res.status(403).json({ error: 'No pertenecés a este local' })

  const { data: local } = await supabaseAdmin.from('locales').select('creado_por').eq('id', localId).maybeSingle()
  if (!local) return res.status(404).json({ error: 'Local no encontrado' })

  const conexion = await getConexionDeOwner(local.creado_por, supabaseAdmin)
  if (!conexion) return res.status(400).json({ error: 'Este local no tiene Mercado Pago conectado' })

  const restantes = segundosParaProximaSincronizacionManual(conexion.ultima_sincronizacion_manual)
  if (restantes > 0) return res.status(429).json({ error: 'Ya se sincronizó hace poco', reintentarEnSegundos: restantes })

  try {
    const hasta = new Date()
    const desde = new Date(hasta.getTime() - VENTANA_SINCRONIZACION_MANUAL_HORAS * 60 * 60 * 1000)
    const resultado = await sincronizarCuenta(supabaseAdmin, conexion, { desde: desde.toISOString(), hasta: hasta.toISOString() })
    await marcarSincronizacionManual(supabaseAdmin, conexion.owner_id)
    return res.status(200).json({ ok: true, ...resultado })
  } catch (err) {
    console.error('Error en la sincronización manual de Mercado Pago', local.creado_por, err)
    return res.status(502).json({ error: `Mercado Pago no respondió: ${err.message}` })
  }
}

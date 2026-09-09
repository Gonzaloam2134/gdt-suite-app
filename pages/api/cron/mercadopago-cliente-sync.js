import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { sincronizarCuenta } from '../../../lib/server/mercadopagoClienteSync'

// Ventana de re-consulta: con margen sobre el intervalo del cron (ver
// vercel.json) para no perder nada si una corrida se retrasa o falla —
// crearPendiente es idempotente, repetir rango no duplica nada.
//
// El plan Hobby de Vercel solo admite crons diarios (falla el deploy con
// cualquier expresión más frecuente — confirmado contra
// https://vercel.com/docs/cron-jobs/usage-and-pricing), por eso esto corre
// una vez al día y la ventana es de 26h (24 + margen), no de un par de
// horas. El botón "Sincronizar" del dashboard (pages/api/mercadopago-
// cliente/sincronizar.js) cubre la necesidad de algo más inmediato mientras
// tanto. Si en algún momento pasan a un plan Pro, para volver a una
// frecuencia mayor alcanza con cambiar el `schedule` en vercel.json (ej.
// "*/30 * * * *") y volver a angostar esta ventana — no hace falta tocar
// nada más.
const VENTANA_HORAS = 26

/**
 * Job periódico (Vercel Cron): por cada cuenta conectada, re-consulta los
 * orders recientes de QR/Point (por si algún webhook no llegó) y busca
 * transferencias comunes (que no tienen webhook — es la única forma de
 * detectarlas, por polling). Protegido con CRON_SECRET para que no lo pueda
 * disparar cualquiera pegándole a la URL.
 */
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  const { data: conexiones, error } = await supabaseAdmin
    .from('conexiones_mercadopago').select('*').is('desconectado_en', null)
  if (error) {
    console.error('No se pudieron listar las conexiones de Mercado Pago para el cron', error)
    return res.status(500).json({ error: error.message })
  }

  const hasta = new Date()
  const desde = new Date(hasta.getTime() - VENTANA_HORAS * 60 * 60 * 1000)
  const resultados = []

  for (const conexion of conexiones || []) {
    try {
      const r = await sincronizarCuenta(supabaseAdmin, conexion, { desde: desde.toISOString(), hasta: hasta.toISOString() })
      resultados.push({ ownerId: conexion.owner_id, ...r })
    } catch (err) {
      console.error('Error sincronizando cuenta de Mercado Pago en el cron', conexion.owner_id, err)
      resultados.push({ ownerId: conexion.owner_id, error: err.message })
    }
  }

  return res.status(200).json({ ok: true, cuentas: resultados.length, resultados })
}

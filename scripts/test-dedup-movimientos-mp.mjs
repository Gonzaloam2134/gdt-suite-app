/**
 * P1 ítem 10 del hardening (sección "Cuenta Mercado Pago del cliente"):
 * "ejecutar dos veces la misma información externa no debe crear dos
 * movimientos internos". webhook, cron, sincronización manual y backfill
 * pasan los 4 por crearPendiente() (lib/services/movimientosMpPendientes.js),
 * que depende de un único constraint real en la base:
 * movimientos_mp_pendientes_owner_id_mp_payment_id_key — UNIQUE(owner_id,
 * mp_payment_id). Como los 4 caminos comparten exactamente ese mecanismo,
 * una sola prueba contra el constraint cubre los 4 escenarios del
 * documento (no hace falta simular cada canal por separado).
 *
 * No es un test de vitest: pega contra la base real, crea y borra sus
 * propios datos. Correrlo a mano con: node scripts/test-dedup-movimientos-mp.mjs
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function cargarEnvLocal() {
  try {
    const contenido = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const linea of contenido.split('\n')) {
      const l = linea.trim()
      if (!l || l.startsWith('#')) continue
      const i = l.indexOf('=')
      if (i === -1) continue
      const clave = l.slice(0, i).trim()
      if (!(clave in process.env)) process.env[clave] = l.slice(i + 1).trim()
    }
  } catch { /* se espera que las env vars ya estén seteadas */ }
}
cargarEnvLocal()

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_SUPABASE || !ANON_KEY || !SERVICE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(URL_SUPABASE, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const sufijo = Date.now()

const resultados = []
const check = (nombre, condicion, detalle = '') => {
  resultados.push({ nombre, ok: !!condicion, detalle })
  console.log((condicion ? '✅' : '❌'), nombre, detalle ? `— ${detalle}` : '')
}

async function main() {
  const email = `dedup-mp-${sufijo}@gdt-audit.local`
  const password = 'Audit-' + Math.random().toString(36).slice(2) + 'Aa1!'
  const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  const cliente = createClient(URL_SUPABASE, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  await cliente.auth.signInWithPassword({ email, password })

  const { data: local } = await cliente.from('locales').insert([{ nombre: `Dedup MP ${sufijo}`, creado_por: u.user.id }]).select().single()
  await cliente.from('miembros_locales').insert([{ local_id: local.id, user_id: u.user.id, rol: 'owner', activo: true }])

  const mpPaymentId = `mp-order-${sufijo}`
  const fila = { owner_id: u.user.id, local_id: local.id, mp_payment_id: mpPaymentId, origen: 'qr', monto: 1500, fecha_mp: new Date().toISOString() }

  console.log('--- Primera vez (ej. llega por webhook) ---')
  const r1 = await admin.from('movimientos_mp_pendientes').insert(fila).select().single()
  check('se crea el pendiente', !r1.error, r1.error?.message)

  console.log('\n--- Mismo movimiento otra vez (ej. el cron lo vuelve a ver, o un backfill solapado) ---')
  const r2 = await admin.from('movimientos_mp_pendientes').insert(fila)
  check('la segunda vez choca con el constraint de idempotencia (23505)', r2.error?.code === '23505', r2.error?.message)

  const { data: todas } = await admin.from('movimientos_mp_pendientes').select('id').eq('owner_id', u.user.id).eq('mp_payment_id', mpPaymentId)
  check('solo hay UN movimiento interno para este mp_payment_id', todas.length === 1, `filas: ${todas.length}`)

  console.log('\n--- Mismo mp_payment_id pero vía un origen distinto (point en vez de qr) — igual es el mismo movimiento ---')
  const r3 = await admin.from('movimientos_mp_pendientes').insert({ ...fila, origen: 'point' })
  check('también choca (el constraint es por owner+mp_payment_id, no por origen)', r3.error?.code === '23505', r3.error?.message)

  const fallidos = resultados.filter(r => !r.ok)
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} OK`)

  await admin.from('movimientos_mp_pendientes').delete().eq('owner_id', u.user.id)
  await admin.from('miembros_locales').delete().eq('local_id', local.id)
  await admin.from('locales').delete().eq('id', local.id)
  await admin.auth.admin.deleteUser(u.user.id)

  return fallidos.length === 0
}

main()
  .then((ok) => { process.exitCode = ok ? 0 : 1 })
  .catch((e) => { console.error('ERROR FATAL:', e.message); process.exitCode = 1 })

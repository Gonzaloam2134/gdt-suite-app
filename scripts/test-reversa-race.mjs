/**
 * P0/P1 ítem 3 del hardening: una sola reversa por transacción, garantizado
 * en Postgres (no solo revalidado en React). Prueba contra la base real:
 * dos reversas "simultáneas" (Promise.all) de la misma transacción original
 * deben dejar exactamente UNA reversa, nunca dos (duplicaría el ajuste
 * financiero).
 *
 * No es un test de vitest: pega contra la base real, crea y borra sus
 * propios datos. Correrlo a mano con: node scripts/test-reversa-race.mjs
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

async function main() {
  const email = `reversa-race-${sufijo}@gdt-audit.local`
  const password = 'Audit-' + Math.random().toString(36).slice(2) + 'Aa1!'
  const { data: u, error: errUser } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (errUser) throw new Error(`creando usuario: ${errUser.message}`)

  const cliente = createClient(URL_SUPABASE, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: errLogin } = await cliente.auth.signInWithPassword({ email, password })
  if (errLogin) throw new Error(`login: ${errLogin.message}`)

  const { data: local, error: errLocal } = await cliente.from('locales')
    .insert([{ nombre: `Reversa Race ${sufijo}`, creado_por: u.user.id }]).select().single()
  if (errLocal) throw new Error(`creando local: ${errLocal.message}`)
  await cliente.from('miembros_locales').insert([{ local_id: local.id, user_id: u.user.id, rol: 'owner', activo: true }])

  const { data: original, error: errTx } = await cliente.from('transacciones')
    .insert([{ local_id: local.id, tipo: 'COBRO_RECIBIDO', monto: 1000 }]).select().single()
  if (errTx) throw new Error(`creando transacción original: ${errTx.message}`)

  const reversar = () => cliente.from('transacciones').insert([{
    local_id: local.id, tipo: original.tipo, monto: -1000, es_reversa: true,
    reversa_de: original.id, motivo_reversa: 'race test',
  }]).select().single()

  console.log('--- Dos reversas "simultáneas" de la misma transacción original ---')
  const [r1, r2] = await Promise.all([reversar(), reversar()])
  const exitosas = [r1, r2].filter(r => !r.error)
  const fallidas = [r1, r2].filter(r => r.error)
  console.log('exitosas:', exitosas.length, '— fallidas:', fallidas.length)
  if (fallidas.length) console.log('código/mensaje de la que falló:', fallidas[0].error.code, '|', fallidas[0].error.message)

  const { data: reversasEnDB } = await admin.from('transacciones').select('id').eq('reversa_de', original.id)

  const ok = exitosas.length === 1 && fallidas.length === 1 && fallidas[0].error.code === '23505'
    && fallidas[0].error.message.includes('tx_una_reversa_por_original')
    && reversasEnDB.length === 1

  console.log(ok ? '\n✅ Garantía sostenida: exactamente 1 reversa, la otra falló por el índice único.' : '\n❌ FALLÓ la garantía')

  await admin.from('transacciones').delete().eq('local_id', local.id)
  await admin.from('miembros_locales').delete().eq('local_id', local.id)
  await admin.from('locales').delete().eq('id', local.id)
  await admin.auth.admin.deleteUser(u.user.id)

  return ok
}

main()
  .then((ok) => { process.exitCode = ok ? 0 : 1 })
  .catch((e) => { console.error('ERROR FATAL:', e.message); process.exitCode = 1 })

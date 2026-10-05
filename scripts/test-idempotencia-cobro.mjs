/**
 * Hardening P2 — ítem 1: un cobro/gasto no se puede duplicar aunque se
 * reintente con la misma idempotency_key (simula el escenario real: la
 * respuesta se pierde por un corte de red y la persona vuelve a tocar
 * "Cobrar"). Prueba contra la base real: dos inserts "simultáneos" con la
 * MISMA idempotency_key deben dejar exactamente UNA transacción.
 *
 * Requiere haber corrido antes MIGRACION_HARDENING_P2_1_IDEMPOTENCIA_COBRO_GASTO.sql
 * (agrega la columna idempotency_key y el índice único tx_idempotency_key_unica).
 *
 * No es un test de vitest: pega contra la base real, crea y borra sus
 * propios datos. Correrlo a mano con: node scripts/test-idempotencia-cobro.mjs
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
  const email = `idempotencia-race-${sufijo}@gdt-audit.local`
  const password = 'Audit-' + Math.random().toString(36).slice(2) + 'Aa1!'
  const { data: u, error: errUser } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (errUser) throw new Error(`creando usuario: ${errUser.message}`)

  const cliente = createClient(URL_SUPABASE, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: errLogin } = await cliente.auth.signInWithPassword({ email, password })
  if (errLogin) throw new Error(`login: ${errLogin.message}`)

  const { data: local, error: errLocal } = await cliente.from('locales')
    .insert([{ nombre: `Idempotencia Race ${sufijo}`, creado_por: u.user.id }]).select().single()
  if (errLocal) throw new Error(`creando local: ${errLocal.message}`)
  await cliente.from('miembros_locales').insert([{ local_id: local.id, user_id: u.user.id, rol: 'owner', activo: true }])

  const { data: medio, error: errMedio } = await cliente.from('medios_pago')
    .insert([{ local_id: local.id, nombre: 'Efectivo', tipo: 'efectivo', comision_porcentaje: 0 }]).select().single()
  if (errMedio) throw new Error(`creando medio de pago: ${errMedio.message}`)

  const idempotencyKey = crypto.randomUUID()
  const cobrar = () => cliente.from('transacciones').insert([{
    local_id: local.id, tipo: 'COBRO_RECIBIDO', medio_pago_id: medio.id,
    monto: 10000, idempotency_key: idempotencyKey,
  }]).select().single()

  console.log('--- Dos cobros "simultáneos" con la MISMA idempotency_key (simula un reintento tras perder la respuesta) ---')
  const [r1, r2] = await Promise.all([cobrar(), cobrar()])
  const exitosas = [r1, r2].filter(r => !r.error)
  const fallidas = [r1, r2].filter(r => r.error)
  console.log('exitosas:', exitosas.length, '— fallidas:', fallidas.length)
  if (fallidas.length) console.log('código/mensaje de la que falló:', fallidas[0].error.code, '|', fallidas[0].error.message)

  const { data: txEnDB } = await admin.from('transacciones').select('id').eq('local_id', local.id).eq('idempotency_key', idempotencyKey)

  const ok = exitosas.length === 1 && fallidas.length === 1 && fallidas[0].error.code === '23505'
    && fallidas[0].error.message.includes('tx_idempotency_key_unica')
    && txEnDB.length === 1

  console.log(ok ? '\n✅ Garantía sostenida: exactamente 1 cobro, el reintento falló por el índice único (no se duplicó la plata).' : '\n❌ FALLÓ la garantía')

  await admin.from('transacciones').delete().eq('local_id', local.id)
  await admin.from('medios_pago').delete().eq('local_id', local.id)
  await admin.from('miembros_locales').delete().eq('local_id', local.id)
  await admin.from('locales').delete().eq('id', local.id)
  await admin.auth.admin.deleteUser(u.user.id)

  return ok
}

main()
  .then((ok) => { process.exitCode = ok ? 0 : 1 })
  .catch((e) => { console.error('ERROR FATAL:', e.message); process.exitCode = 1 })

/**
 * P1 ítem 7 del hardening: idempotencia real de los webhooks de Mercado
 * Pago. Prueba las dos funciones DB (registrar_intento_webhook_mp,
 * marcar_webhook_mp_resultado) directamente, simulando los 3 escenarios
 * del documento: evento nuevo, evento duplicado de uno YA completado, y
 * reintento de uno que había FALLADO (tiene que volver a procesarse).
 *
 * No es un test de vitest: pega contra la base real, crea y borra sus
 * propios datos. Correrlo a mano con: node scripts/test-idempotencia-webhook.mjs
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
const anon = createClient(URL_SUPABASE, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const sufijo = Date.now()
const notifId = `test:payment:${sufijo}`

const resultados = []
const check = (nombre, condicion, detalle = '') => {
  resultados.push({ nombre, ok: !!condicion, detalle })
  console.log((condicion ? '✅' : '❌'), nombre, detalle ? `— ${detalle}` : '')
}

async function main() {
  console.log('--- Evento nuevo: debe procesarse ---')
  const r1 = await admin.rpc('registrar_intento_webhook_mp', { p_id: notifId })
  check('primera vez: debeProcesar=true', r1.data === true, JSON.stringify(r1))

  console.log('\n--- Simula que el procesamiento FALLÓ (no se marca completado) ---')
  await admin.rpc('marcar_webhook_mp_resultado', { p_id: notifId, p_exito: false, p_error: 'timeout simulado' })

  console.log('\n--- MP reintenta el MISMO evento: como falló antes, debe volver a procesarse ---')
  const r2 = await admin.rpc('registrar_intento_webhook_mp', { p_id: notifId })
  check('reintento tras fallo: debeProcesar=true (no se pierde el evento)', r2.data === true, JSON.stringify(r2))

  const { data: filaTrasFallo } = await admin.from('mp_notificaciones_procesadas').select('*').eq('id', notifId).single()
  check('intentos quedó en 2', filaTrasFallo.intentos === 2, `intentos: ${filaTrasFallo.intentos}`)
  check('ultimo_error quedó guardado', filaTrasFallo.ultimo_error === 'timeout simulado', filaTrasFallo.ultimo_error)
  check('completada_en sigue null (no se completó)', filaTrasFallo.completada_en === null)

  console.log('\n--- Esta vez el procesamiento tiene éxito ---')
  await admin.rpc('marcar_webhook_mp_resultado', { p_id: notifId, p_exito: true })

  console.log('\n--- MP reintenta el MISMO evento otra vez: ya se completó, NO debe reprocesarse ---')
  const r3 = await admin.rpc('registrar_intento_webhook_mp', { p_id: notifId })
  check('duplicado real tras éxito: debeProcesar=false', r3.data === false, JSON.stringify(r3))

  console.log('\n--- Las funciones no deben ser invocables sin sesión de servidor (anon) ---')
  const rAnon = await anon.rpc('registrar_intento_webhook_mp', { p_id: notifId })
  check('anon no puede llamar a registrar_intento_webhook_mp', !!rAnon.error, rAnon.error?.message)

  const fallidos = resultados.filter(r => !r.ok)
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} OK`)

  await admin.from('mp_notificaciones_procesadas').delete().eq('id', notifId)

  return fallidos.length === 0
}

main()
  .then((ok) => { process.exitCode = ok ? 0 : 1 })
  .catch((e) => { console.error('ERROR FATAL:', e.message); process.exitCode = 1 })

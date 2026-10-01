/**
 * P1 ítem 6 del hardening: el cierre de caja no puede confiar en totales
 * cacheados en la pantalla — tiene que reflejar TODO lo que pasó en el
 * local hasta el momento de cerrar, aunque se haya cargado desde otro
 * dispositivo mientras el modal de cierre estaba abierto. Es justo lo que
 * el dueño compara contra su cuaderno (CLAUDE.md).
 *
 * Reproduce el mismo camino que ahora usa hooks/useCaja.js (cerrar/
 * cerrarHuerfana): recalcula totales justo antes de escribir, en vez de
 * recibirlos ya calculados.
 *
 * No es un test de vitest: pega contra la base real, crea y borra sus
 * propios datos. Correrlo a mano con: node scripts/test-cierre-caja-fresco.mjs
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
  const email = `cierre-fresco-${sufijo}@gdt-audit.local`
  const password = 'Audit-' + Math.random().toString(36).slice(2) + 'Aa1!'
  const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  const cliente = createClient(URL_SUPABASE, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  await cliente.auth.signInWithPassword({ email, password })

  const { data: local } = await cliente.from('locales').insert([{ nombre: `Cierre Fresco ${sufijo}`, creado_por: u.user.id }]).select().single()
  await cliente.from('miembros_locales').insert([{ local_id: local.id, user_id: u.user.id, rol: 'owner', activo: true }])
  const { data: medio } = await cliente.from('medios_pago').insert([{ local_id: local.id, nombre: 'Efectivo', tipo: 'efectivo' }]).select().single()

  const { data: caja } = await cliente.from('cierres_caja')
    .insert([{ local_id: local.id, user_id: u.user.id, estado: 'abierta', monto_inicial_efectivo: 1000, fecha_apertura: new Date().toISOString() }])
    .select().single()

  // "Pantalla abierta" con el cobro inicial ya cargado.
  await cliente.from('transacciones').insert([{ local_id: local.id, tipo: 'COBRO_RECIBIDO', medio_pago_id: medio.id, monto: 500 }])

  // Esto es lo que useCaja.cerrar() ve ANTES de recalcular (lo que habría
  // quedado cacheado en React si no se refrescara): 1 transacción, $500.
  const diaISO = new Date().toISOString().slice(0, 10)
  const { inicio, fin } = { inicio: `${diaISO}T00:00:00.000Z`, fin: `${diaISO}T23:59:59.999Z` }
  const snapshotViejo = await cliente.from('transacciones').select('id').eq('local_id', local.id)
    .gte('creado_en', inicio).lte('creado_en', fin)
  check('snapshot "cacheado": 1 transacción antes del cobro tardío', snapshotViejo.data.length === 1, `filas: ${snapshotViejo.data.length}`)

  // "Otro dispositivo" carga un cobro más MIENTRAS el modal de cierre está abierto.
  await cliente.from('transacciones').insert([{ local_id: local.id, tipo: 'COBRO_RECIBIDO', medio_pago_id: medio.id, monto: 300 }])

  // Esto es lo que useCaja.cerrar() hace ahora: recalcula justo antes de escribir.
  const fresco = await cliente.from('transacciones').select('monto').eq('local_id', local.id)
    .gte('creado_en', inicio).lte('creado_en', fin)
  const totalFresco = fresco.data.reduce((acc, t) => acc + Number(t.monto), 0)
  check('el recálculo fresco SÍ incluye el cobro tardío (2 transacciones, $800)', fresco.data.length === 2 && totalFresco === 800, `filas: ${fresco.data.length}, total: ${totalFresco}`)

  const cierre = await cliente.from('cierres_caja').update({
    estado: 'cerrada', fecha_cierre: new Date().toISOString(),
    total_cobrado: totalFresco, total_gastado: 0, cantidad_transacciones: fresco.data.length,
    efectivo_fisico: 1800, diferencia_efectivo: 0,
  }).eq('id', caja.id).select().single()
  check('cierre guardado con el total fresco ($800), no el viejo ($500)', Number(cierre.data?.total_cobrado) === 800, `guardado: ${cierre.data?.total_cobrado}`)

  const fallidos = resultados.filter(r => !r.ok)
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} OK`)

  await admin.from('transacciones').delete().eq('local_id', local.id)
  await admin.from('cierres_caja').delete().eq('local_id', local.id)
  await admin.from('medios_pago').delete().eq('local_id', local.id)
  await admin.from('miembros_locales').delete().eq('local_id', local.id)
  await admin.from('locales').delete().eq('id', local.id)
  await admin.auth.admin.deleteUser(u.user.id)

  return fallidos.length === 0
}

main()
  .then((ok) => { process.exitCode = ok ? 0 : 1 })
  .catch((e) => { console.error('ERROR FATAL:', e.message); process.exitCode = 1 })

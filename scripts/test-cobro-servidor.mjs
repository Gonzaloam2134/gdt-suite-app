/**
 * P1 ítem 5 del hardening: la comisión/IVA/fecha de acreditación de un cobro
 * no pueden depender de lo que mande el navegador. Prueba contra la base
 * real, simulando una request directa (sin pasar por la UI) que intenta
 * forjar esos campos.
 *
 * No es un test de vitest: pega contra la base real, crea y borra sus
 * propios datos. Correrlo a mano con: node scripts/test-cobro-servidor.mjs
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
  const emailA = `cobro-srv-a-${sufijo}@gdt-audit.local`
  const emailB = `cobro-srv-b-${sufijo}@gdt-audit.local`
  const password = 'Audit-' + Math.random().toString(36).slice(2) + 'Aa1!'
  const { data: uA } = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true })
  const { data: uB } = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true })

  const clienteA = createClient(URL_SUPABASE, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  await clienteA.auth.signInWithPassword({ email: emailA, password })
  const clienteB = createClient(URL_SUPABASE, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  await clienteB.auth.signInWithPassword({ email: emailB, password })

  const { data: localA } = await clienteA.from('locales').insert([{ nombre: `Cobro Srv A ${sufijo}`, creado_por: uA.user.id }]).select().single()
  await clienteA.from('miembros_locales').insert([{ local_id: localA.id, user_id: uA.user.id, rol: 'owner', activo: true }])
  const { data: medioA } = await clienteA.from('medios_pago')
    .insert([{ local_id: localA.id, nombre: 'Tarjeta crédito', comision_porcentaje: 5, plazo_acreditacion_dias: 18 }]).select().single()

  const { data: localB } = await clienteB.from('locales').insert([{ nombre: `Cobro Srv B ${sufijo}`, creado_por: uB.user.id }]).select().single()
  await clienteB.from('miembros_locales').insert([{ local_id: localB.id, user_id: uB.user.id, rol: 'owner', activo: true }])
  const { data: medioB } = await clienteB.from('medios_pago')
    .insert([{ local_id: localB.id, nombre: 'Efectivo', comision_porcentaje: 0, plazo_acreditacion_dias: 0 }]).select().single()

  console.log('\n--- Cobro legítimo: la DB calcula comisión/IVA/acreditación a partir del medio real ---')
  const cobro = await clienteA.from('transacciones').insert([{
    local_id: localA.id, tipo: 'COBRO_RECIBIDO', medio_pago_id: medioA.id, monto: 1000, alicuota_iva: 21,
  }]).select().single()
  check('cobro aceptado', !cobro.error, cobro.error?.message)
  if (!cobro.error) {
    check('comision_monto calculada = 5% de 1000 = 50', Number(cobro.data.comision_monto) === 50, `obtenido: ${cobro.data.comision_monto}`)
    check('monto_iva calculado correctamente (≈173.55)', Math.abs(Number(cobro.data.monto_iva) - 173.55) < 0.01, `obtenido: ${cobro.data.monto_iva}`)
  }

  console.log('\n--- Intento de forjar comisión/IVA/fecha desde el navegador (deben ser IGNORADOS) ---')
  const forjado = await clienteA.from('transacciones').insert([{
    local_id: localA.id, tipo: 'COBRO_RECIBIDO', medio_pago_id: medioA.id, monto: 1000, alicuota_iva: 21,
    comision_monto: 0, monto_iva: 1, monto_neto: 999, fecha_acreditacion_estimada: '2020-01-01',
  }]).select().single()
  check('insert aceptado (no rechazado, pero recalculado)', !forjado.error, forjado.error?.message)
  if (!forjado.error) {
    check('comision_monto REAL (50), no el forjado (0)', Number(forjado.data.comision_monto) === 50, `obtenido: ${forjado.data.comision_monto}`)
    check('monto_iva REAL (≈173.55), no el forjado (1)', Math.abs(Number(forjado.data.monto_iva) - 173.55) < 0.01, `obtenido: ${forjado.data.monto_iva}`)
    check('fecha_acreditacion_estimada REAL (no 2020-01-01)', forjado.data.fecha_acreditacion_estimada !== '2020-01-01', `obtenido: ${forjado.data.fecha_acreditacion_estimada}`)
  }

  console.log('\n--- B intenta usar un medio_pago_id de A (cross-tenant) ---')
  const cruzado = await clienteB.from('transacciones').insert([{
    local_id: localB.id, tipo: 'COBRO_RECIBIDO', medio_pago_id: medioA.id, monto: 1000,
  }])
  check('rechazado: el medio no pertenece al local de B', !!cruzado.error, cruzado.error?.message)

  console.log('\n--- Gasto: la comisión siempre debe quedar en 0, aunque el medio tenga comisión ---')
  const gasto = await clienteA.from('transacciones').insert([{
    local_id: localA.id, tipo: 'GASTO_REGISTRADO', medio_pago_id: medioA.id, monto: 500,
  }]).select().single()
  check('gasto aceptado', !gasto.error, gasto.error?.message)
  if (!gasto.error) check('comision_monto del gasto = 0 (no 25)', Number(gasto.data.comision_monto) === 0, `obtenido: ${gasto.data.comision_monto}`)

  console.log('\n--- Reversa: clona los valores YA GUARDADOS, no recalcula con la comisión actual ---')
  if (!cobro.error) {
    const reversa = await clienteA.from('transacciones').insert([{
      local_id: localA.id, tipo: cobro.data.tipo, medio_pago_id: cobro.data.medio_pago_id,
      monto: -Number(cobro.data.monto), comision_monto: -Number(cobro.data.comision_monto),
      monto_iva: -Number(cobro.data.monto_iva), monto_neto: -Number(cobro.data.monto_neto),
      alicuota_iva: cobro.data.alicuota_iva, es_reversa: true, reversa_de: cobro.data.id, motivo_reversa: 'test',
    }]).select().single()
    check('reversa aceptada con los valores negados del original', !reversa.error, reversa.error?.message)
    if (!reversa.error) check('comision_monto de la reversa = -50 (el original, negado)', Number(reversa.data.comision_monto) === -50, `obtenido: ${reversa.data.comision_monto}`)
  }

  const fallidos = resultados.filter(r => !r.ok)
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} OK`)

  // limpieza
  for (const local of [localA, localB]) {
    await admin.from('transacciones').delete().eq('local_id', local.id)
    await admin.from('medios_pago').delete().eq('local_id', local.id)
    await admin.from('miembros_locales').delete().eq('local_id', local.id)
    await admin.from('locales').delete().eq('id', local.id)
  }
  await admin.auth.admin.deleteUser(uA.user.id)
  await admin.auth.admin.deleteUser(uB.user.id)

  return fallidos.length === 0
}

main()
  .then((ok) => { process.exitCode = ok ? 0 : 1 })
  .catch((e) => { console.error('ERROR FATAL:', e.message); process.exitCode = 1 })

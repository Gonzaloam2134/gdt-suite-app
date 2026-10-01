/**
 * P0 ítem 4 del hardening: validaciones financieras en DB. Prueba contra la
 * base real que los CHECK constraints (MIGRACION_HARDENING_P0_4_VALIDACIONES_FINANCIERAS.sql)
 * rechazan valores financieramente imposibles, SIN romper el flujo normal
 * de cobro/gasto/reversa/apertura/cierre de caja (que usa montos negativos
 * legítimamente en las reversas).
 *
 * No es un test de vitest: pega contra la base real, crea y borra sus
 * propios datos. Correrlo a mano con: node scripts/test-validaciones-financieras.mjs
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
  const email = `fin-check-${sufijo}@gdt-audit.local`
  const password = 'Audit-' + Math.random().toString(36).slice(2) + 'Aa1!'
  const { data: u, error: errUser } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (errUser) throw new Error(`creando usuario: ${errUser.message}`)

  const cliente = createClient(URL_SUPABASE, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: errLogin } = await cliente.auth.signInWithPassword({ email, password })
  if (errLogin) throw new Error(`login: ${errLogin.message}`)

  const { data: local, error: errLocal } = await cliente.from('locales')
    .insert([{ nombre: `Fin Check ${sufijo}`, creado_por: u.user.id }]).select().single()
  if (errLocal) throw new Error(`creando local: ${errLocal.message}`)
  await cliente.from('miembros_locales').insert([{ local_id: local.id, user_id: u.user.id, rol: 'owner', activo: true }])

  console.log('\n--- Valores financieramente imposibles (deben ser RECHAZADOS) ---')

  const cobroNegativoSinReversa = await cliente.from('transacciones')
    .insert([{ local_id: local.id, tipo: 'COBRO_RECIBIDO', monto: -500, es_reversa: false }])
  check('cobro con monto negativo sin es_reversa: rechazado', !!cobroNegativoSinReversa.error, cobroNegativoSinReversa.error?.message)

  const cobroCero = await cliente.from('transacciones')
    .insert([{ local_id: local.id, tipo: 'COBRO_RECIBIDO', monto: 0 }])
  check('cobro con monto = 0: rechazado', !!cobroCero.error, cobroCero.error?.message)

  const reversaPositiva = await cliente.from('transacciones')
    .insert([{ local_id: local.id, tipo: 'COBRO_RECIBIDO', monto: 500, es_reversa: true, reversa_de: '00000000-0000-0000-0000-000000000000' }])
  check('reversa con monto positivo: rechazada', !!reversaPositiva.error, reversaPositiva.error?.message)

  const comisionSignoInvertido = await cliente.from('transacciones')
    .insert([{ local_id: local.id, tipo: 'COBRO_RECIBIDO', monto: 1000, comision_monto: -50 }])
  check('cobro positivo con comisión negativa: rechazado', !!comisionSignoInvertido.error, comisionSignoInvertido.error?.message)

  const esReversaInconsistente = await cliente.from('transacciones')
    .insert([{ local_id: local.id, tipo: 'COBRO_RECIBIDO', monto: -500, es_reversa: true, reversa_de: null }])
  check('es_reversa=true sin reversa_de: rechazado', !!esReversaInconsistente.error, esReversaInconsistente.error?.message)

  const cajaMontoNegativo = await cliente.from('cierres_caja')
    .insert([{ local_id: local.id, user_id: u.user.id, estado: 'abierta', monto_inicial_efectivo: -100 }])
  check('caja con monto_inicial_efectivo negativo: rechazada', !!cajaMontoNegativo.error, cajaMontoNegativo.error?.message)

  const medioComisionFueraDeRango = await cliente.from('medios_pago')
    .insert([{ local_id: local.id, nombre: 'Rarísimo', comision_porcentaje: 150 }])
  check('medio de pago con comisión de 150%: rechazado', !!medioComisionFueraDeRango.error, medioComisionFueraDeRango.error?.message)

  console.log('\n--- Flujo legítimo (debe seguir funcionando) ---')

  const cobroOk = await cliente.from('transacciones')
    .insert([{ local_id: local.id, tipo: 'COBRO_RECIBIDO', monto: 1000, comision_monto: 30, monto_iva: 173.55, monto_neto: 826.45 }])
    .select().single()
  check('cobro normal (positivo, con comisión/IVA positivos): aceptado', !cobroOk.error, cobroOk.error?.message)

  if (!cobroOk.error) {
    const reversaOk = await cliente.from('transacciones').insert([{
      local_id: local.id, tipo: 'COBRO_RECIBIDO', monto: -1000, comision_monto: -30,
      monto_iva: -173.55, monto_neto: -826.45, es_reversa: true, reversa_de: cobroOk.data.id, motivo_reversa: 'test',
    }])
    check('reversa legítima del cobro anterior: aceptada', !reversaOk.error, reversaOk.error?.message)
  }

  const cajaOk = await cliente.from('cierres_caja')
    .insert([{ local_id: local.id, user_id: u.user.id, estado: 'abierta', monto_inicial_efectivo: 5000 }]).select().single()
  check('apertura de caja normal: aceptada', !cajaOk.error, cajaOk.error?.message)

  if (!cajaOk.error) {
    const cierreOk = await cliente.from('cierres_caja').update({
      estado: 'cerrada', fecha_cierre: new Date().toISOString(),
      total_cobrado: 1000, total_gastado: 0, efectivo_fisico: 6000, diferencia_efectivo: -1000,
    }).eq('id', cajaOk.data.id).select()
    check('cierre de caja normal CON FALTANTE (diferencia negativa): aceptado', !cierreOk.error, cierreOk.error?.message)
  }

  const medioOk = await cliente.from('medios_pago')
    .insert([{ local_id: local.id, nombre: 'Efectivo', comision_porcentaje: 0, plazo_acreditacion_dias: 0 }])
  check('medio de pago normal: aceptado', !medioOk.error, medioOk.error?.message)

  const fallidos = resultados.filter(r => !r.ok)
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} OK`)

  // limpieza
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

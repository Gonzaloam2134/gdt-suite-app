/**
 * Suite de aislamiento multi-tenant (RLS) — P0 ítem 1 del hardening.
 *
 * Reproduce el escenario pedido:
 *   Usuario A: Local A1, Local A2
 *   Usuario B: Local B1
 * y verifica que B no pueda leer, insertar, actualizar ni "fabricar" datos
 * de los locales de A (ni viceversa), probando contra la base REAL con dos
 * usuarios de Auth creados y destruidos en cada corrida.
 *
 * No es un test de vitest: pega contra la base de producción (no hay otra
 * todavía) usando las claves de .env.local, crea y borra sus propios datos.
 * Correrlo a mano con: node scripts/audit-rls.mjs
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
      const valor = l.slice(i + 1).trim()
      if (!(clave in process.env)) process.env[clave] = valor
    }
  } catch { /* si no existe .env.local, se espera que las env vars ya estén seteadas */ }
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

const resultados = []
const check = (nombre, condicion, detalle = '') => {
  resultados.push({ nombre, ok: !!condicion, detalle })
  console.log((condicion ? '✅' : '❌'), nombre, detalle ? `— ${detalle}` : '')
}

async function crearUsuario(email) {
  const password = 'Audit-' + Math.random().toString(36).slice(2) + 'Aa1!'
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`creando usuario ${email}: ${error.message}`)
  const cliente = createClient(URL_SUPABASE, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: errSignIn } = await cliente.auth.signInWithPassword({ email, password })
  if (errSignIn) throw new Error(`login de ${email}: ${errSignIn.message}`)
  return { id: data.user.id, cliente }
}

async function crearLocalConOwner(cliente, userId, nombre) {
  const { data: local, error: errLocal } = await cliente.from('locales')
    .insert([{ nombre, creado_por: userId }]).select().single()
  if (errLocal) throw new Error(`creando local ${nombre}: ${errLocal.message}`)
  const { error: errMiembro } = await cliente.from('miembros_locales')
    .insert([{ local_id: local.id, user_id: userId, rol: 'owner', activo: true, aceptado_en: new Date().toISOString() }])
  if (errMiembro) throw new Error(`creando miembro owner de ${nombre}: ${errMiembro.message}`)
  return local.id
}

const sufijo = Date.now()
const limpieza = { userIds: [], localIds: [] }

async function limpiar() {
  // Con service_role (bypassa RLS) — orden importa por FKs.
  if (limpieza.localIds.length) {
    await admin.from('transacciones').delete().in('local_id', limpieza.localIds)
    await admin.from('cierres_caja').delete().in('local_id', limpieza.localIds)
    await admin.from('medios_pago').delete().in('local_id', limpieza.localIds)
    await admin.from('miembros_locales').delete().in('local_id', limpieza.localIds)
    await admin.from('suscripciones').delete().in('local_id', limpieza.localIds)
    await admin.from('locales').delete().in('id', limpieza.localIds)
  }
  if (limpieza.userIds.length) {
    await admin.from('suscripciones_cuenta').delete().in('owner_id', limpieza.userIds)
    for (const id of limpieza.userIds) await admin.auth.admin.deleteUser(id).catch(() => {})
  }
}

async function main() {
  const A = await crearUsuario(`rls-audit-a-${sufijo}@gdt-audit.local`)
  const B = await crearUsuario(`rls-audit-b-${sufijo}@gdt-audit.local`)
  limpieza.userIds.push(A.id, B.id)

  const locA1 = await crearLocalConOwner(A.cliente, A.id, `RLS Audit A1 ${sufijo}`)
  const locA2 = await crearLocalConOwner(A.cliente, A.id, `RLS Audit A2 ${sufijo}`)
  const locB1 = await crearLocalConOwner(B.cliente, B.id, `RLS Audit B1 ${sufijo}`)
  limpieza.localIds.push(locA1, locA2, locB1)

  // Datos de A en A1, para que B intente leerlos/tocarlos.
  const { data: txA1 } = await A.cliente.from('transacciones')
    .insert([{ local_id: locA1, tipo: 'COBRO_RECIBIDO', monto: 1000 }]).select().single()
  const { data: cierreA1 } = await A.cliente.from('cierres_caja')
    .insert([{ local_id: locA1, user_id: A.id, monto_inicial_efectivo: 500 }]).select().single()
  const { data: medioA1 } = await A.cliente.from('medios_pago')
    .insert([{ local_id: locA1, nombre: 'Efectivo', creado_por: A.id }]).select().single()

  console.log('\n--- B contra los locales de A (debe ver / tocar CERO) ---')

  const selLocales = await B.cliente.from('locales').select('id').in('id', [locA1, locA2])
  check('B no ve los locales de A por SELECT', (selLocales.data?.length ?? 0) === 0, `filas: ${selLocales.data?.length}`)

  const selMiembros = await B.cliente.from('miembros_locales').select('id').eq('local_id', locA1)
  check('B no ve miembros_locales de A1', (selMiembros.data?.length ?? 0) === 0, `filas: ${selMiembros.data?.length}`)

  const selTx = await B.cliente.from('transacciones').select('id').eq('local_id', locA1)
  check('B no ve transacciones de A1', (selTx.data?.length ?? 0) === 0, `filas: ${selTx.data?.length}`)

  const selCierres = await B.cliente.from('cierres_caja').select('id').eq('local_id', locA1)
  check('B no ve cierres_caja de A1', (selCierres.data?.length ?? 0) === 0, `filas: ${selCierres.data?.length}`)

  const selMedios = await B.cliente.from('medios_pago').select('id').eq('local_id', locA1)
  check('B no ve medios_pago de A1', (selMedios.data?.length ?? 0) === 0, `filas: ${selMedios.data?.length}`)

  const selPerfilA = await B.cliente.from('perfiles').select('id').eq('id', A.id)
  check('B no ve el perfil de A', (selPerfilA.data?.length ?? 0) === 0, `filas: ${selPerfilA.data?.length}`)

  console.log('\n--- B intenta escribir en A1 (debe fallar o afectar CERO filas) ---')

  const insTx = await B.cliente.from('transacciones').insert([{ local_id: locA1, tipo: 'COBRO_RECIBIDO', monto: 999 }])
  check('B no puede insertar una transacción en A1', !!insTx.error, insTx.error?.message ?? 'se insertó sin error')

  const updCierre = await B.cliente.from('cierres_caja').update({ estado: 'cerrada' }).eq('id', cierreA1.id).select()
  check('B no puede actualizar el cierre de caja de A1', (updCierre.data?.length ?? 0) === 0, `filas afectadas: ${updCierre.data?.length}`)

  const updLocal = await B.cliente.from('locales').update({ nombre: 'hackeado' }).eq('id', locA1).select()
  check('B no puede renombrar el local A1', (updLocal.data?.length ?? 0) === 0, `filas afectadas: ${updLocal.data?.length}`)

  const delTx = await B.cliente.from('transacciones').delete().eq('id', txA1.id).select()
  check('B no puede borrar la transacción de A1', (delTx.data?.length ?? 0) === 0, `filas afectadas: ${delTx.data?.length}`)

  console.log('\n--- "Fabricar" un local_id / owner_id ajeno ---')

  const fabricarLocal = await B.cliente.from('locales').insert([{ nombre: 'Fantasma', creado_por: A.id }])
  check('B no puede crear un local atribuido a A (creado_por ajeno)', !!fabricarLocal.error, fabricarLocal.error?.message ?? 'se insertó sin error')

  const fabricarMiembro = await B.cliente.from('miembros_locales')
    .insert([{ local_id: locA1, user_id: B.id, rol: 'owner', activo: true }])
  check('B no puede auto-agregarse como miembro de A1', !!fabricarMiembro.error, fabricarMiembro.error?.message ?? 'se insertó sin error')

  console.log('\n--- Forjar auditoría en un local ajeno (hardening P0-1) ---')

  const logForjado = await B.cliente.from('logs_auditoria')
    .insert([{ local_id: locA1, user_id: B.id, accion: 'AUDIT_FORJADO' }]).select()
  check('B no puede insertar un log de auditoría en A1', !!logForjado.error, logForjado.error?.message ?? 'se insertó sin error')
  if (logForjado.data?.length) await admin.from('logs_auditoria').delete().eq('id', logForjado.data[0].id)

  console.log('\n--- Funciones SECURITY DEFINER no deben ser invocables sin sesión (hardening P0-1) ---')

  const rpcLog = await anon.rpc('registrar_log', { p_local_id: locA1, p_user_id: A.id, p_accion: 'POC_ANONIMO', p_detalles: {} })
  check('anon no puede llamar a registrar_log', !!rpcLog.error, rpcLog.error?.message ?? 'se ejecutó sin error')

  const rpcOwner = await anon.rpc('is_local_owner', { check_local_id: locA1, check_user_id: A.id })
  check('anon no puede llamar a is_local_owner', !!rpcOwner.error, rpcOwner.error?.message ?? `se ejecutó sin error, resultado: ${rpcOwner.data}`)

  const rpcRol = await anon.rpc('rol_existente_de', { p_email: `rls-audit-a-${sufijo}@gdt-audit.local` })
  check('anon no puede llamar a rol_existente_de', !!rpcRol.error, rpcRol.error?.message ?? `se ejecutó sin error, resultado: ${JSON.stringify(rpcRol.data)}`)

  const rpcInvitacion = await anon.rpc('aceptar_invitacion', { p_token: 'token-inexistente' })
  check('anon no puede llamar a aceptar_invitacion', !!rpcInvitacion.error, rpcInvitacion.error?.message ?? `se ejecutó sin error, resultado: ${JSON.stringify(rpcInvitacion.data)}`)

  console.log('\n--- Control: ni siquiera A puede borrar sus propias transacciones (nada se borra) ---')
  const delPropia = await A.cliente.from('transacciones').delete().eq('id', txA1.id).select()
  check('A tampoco puede hacer DELETE físico de una transacción', (delPropia.data?.length ?? 0) === 0, `filas afectadas: ${delPropia.data?.length}`)

  console.log('\n--- Control positivo: A sí ve y opera sus propios A1/A2 ---')
  const selPropia = await A.cliente.from('locales').select('id').in('id', [locA1, locA2])
  check('A ve sus propios locales A1 y A2', (selPropia.data?.length ?? 0) === 2, `filas: ${selPropia.data?.length}`)

  const fallidos = resultados.filter(r => !r.ok)
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} OK`)
  if (fallidos.length) {
    console.log('\nFALLARON:')
    for (const f of fallidos) console.log(' -', f.nombre, f.detalle)
  }
  return fallidos.length === 0
}

main()
  .then(async (ok) => { await limpiar(); process.exitCode = ok ? 0 : 1 })
  .catch(async (e) => { console.error('ERROR FATAL:', e.message); await limpiar(); process.exitCode = 1 })

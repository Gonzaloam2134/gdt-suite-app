import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

/**
 * La suscripción es POR CUENTA (el dueño), no por local: un local no tiene
 * su propia fila, cubre todos los locales de quien los creó. Las funciones
 * de acá siguen recibiendo un `localId` en la mayoría de los casos —a
 * propósito, para no tener que tocar cada pantalla que ya las llama— pero
 * por dentro resuelven al dueño real (`locales.creado_por`) antes de tocar
 * `suscripciones_cuenta`.
 */

const getOwnerDeLocal = async (localId) => {
  const local = await supabase.from('locales').select('creado_por').eq('id', localId).maybeSingle().then(unwrap)
  return local?.creado_por ?? null
}

/** Suscripción de la cuenta a la que pertenece este local. */
export const getSuscripcion = async (localId) => {
  const ownerId = await getOwnerDeLocal(localId)
  if (!ownerId) return null
  return supabase.from('suscripciones_cuenta').select('*').eq('owner_id', ownerId).maybeSingle().then(unwrap)
}

/** Suscripción de una cuenta, cuando ya se tiene el id del dueño a mano. */
export const getSuscripcionDeCuenta = (ownerId) =>
  supabase.from('suscripciones_cuenta').select('*').eq('owner_id', ownerId).maybeSingle().then(unwrap)

/**
 * La crea el trigger `crear_prueba_si_no_existe` al crear el primer local
 * (con `on conflict (owner_id) do nothing`, así que un segundo o tercer
 * local nunca reinicia la prueba). Esta función queda por si hace falta
 * crearla a mano alguna vez — el flujo normal no la necesita.
 */
export const crearSuscripcionPrueba = (ownerId, dias = 30) =>
  supabase.from('suscripciones_cuenta').insert([{
    owner_id: ownerId, plan: 'trial', estado: 'active',
    fecha_vencimiento: new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }]).then(unwrap)

/** Pasar a un plan pago: lo usa el flujo de Mercado Pago al confirmar el cobro. */
export const activarPlanPago = (ownerId, { segmento, ciclo, fechaVencimiento, mpPreapprovalId, mpPayerEmail }) =>
  supabase.from('suscripciones_cuenta').update({
    plan: 'pago', estado: 'active', segmento, ciclo,
    fecha_vencimiento: fechaVencimiento,
    mp_preapproval_id: mpPreapprovalId ?? null,
    mp_payer_email: mpPayerEmail ?? null,
    actualizado_en: new Date().toISOString(),
  }).eq('owner_id', ownerId).then(unwrap)

/**
 * Para el panel de super admin: una fila por CUENTA (no por local), con la
 * lista de locales que cubre cada una.
 *
 * `suscripciones_cuenta` y `locales` NO tienen una relación directa entre sí
 * (una cuenta puede tener varios locales; el vínculo real es owner_id <->
 * creado_por, cada uno apuntando a `perfiles`, no entre ellas). PostgREST no
 * puede "embeber" eso en una sola consulta — se traen las dos por separado
 * y se unen acá. Sin `!inner`: una cuenta sin ningún local vivo igual tiene
 * que aparecer, no desaparecer en silencio.
 */
export const listarSuscripcionesConOwner = async (limite = 200) => {
  const [cuentas, locales] = await Promise.all([
    supabase.from('suscripciones_cuenta')
      .select('*, perfiles!suscripciones_cuenta_owner_id_fkey (email, nombre)')
      .order('fecha_vencimiento', { ascending: true })
      .limit(limite)
      .then(unwrap),
    supabase.from('locales').select('id, nombre, rubro, creado_por').then(unwrap),
  ])

  return cuentas.map(c => {
    const localesDeLaCuenta = locales.filter(l => l.creado_por === c.owner_id)
    return {
      ...c,
      ownerEmail: c.perfiles?.email || 'Sin email',
      locales: localesDeLaCuenta,
      cantidadLocales: localesDeLaCuenta.length,
    }
  })
}

/** Acepta localId (resuelve el dueño) para no romper las pantallas que ya lo usan así. */
export const cambiarEstadoSuscripcion = async (localId, estado) => {
  const ownerId = await getOwnerDeLocal(localId)
  if (!ownerId) throw new Error('No se encontró el dueño de este local')
  return cambiarEstadoCuenta(ownerId, estado)
}

/** Directo por owner_id, para cuando ya se tiene la cuenta a mano (ej. el
 *  panel de super admin listando cuentas, no locales). */
export const cambiarEstadoCuenta = (ownerId, estado) =>
  supabase.from('suscripciones_cuenta')
    .update({ estado, actualizado_en: new Date().toISOString() })
    .eq('owner_id', ownerId).then(unwrap)

import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { buscarStore, crearStore, buscarPos, crearPos } from '../../../lib/server/mercadopagoCliente'
import { geocodificarDireccion } from '../../../lib/server/geocoding'
import { tokenVigente } from '../../../lib/server/mercadopagoClienteAuth'
import { sincronizarCuenta, DIAS_BACKFILL_INICIAL } from '../../../lib/server/mercadopagoClienteSync'
import { getConexionDeOwner } from '../../../lib/services/conexionesMercadopago'
import { guardarMapeo } from '../../../lib/services/mapeoLocalesMp'
import { derivarExternalStoreId, derivarExternalPosId, extraerValorValidoDelError } from '../../../lib/domain/mercadopagoCliente'

/**
 * Después de conectar la cuenta, crea (o reutiliza) la Store y el POS de
 * Mercado Pago para UN local del dueño, y guarda el mapeo. Un local = una
 * Store + un POS, por ahora (Fase A) — nada acá pide que el comerciante
 * haya configurado nada de antemano en el panel de MP.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'No autenticado' })

  const { localId } = req.body || {}
  if (!localId) return res.status(400).json({ error: 'Falta el local' })

  const { data: membresia } = await supabaseAdmin
    .from('miembros_locales').select('rol').eq('local_id', localId).eq('user_id', user.id).eq('activo', true).maybeSingle()
  if (membresia?.rol !== 'owner') {
    return res.status(403).json({ error: 'Solo el dueño puede vincular Mercado Pago' })
  }

  const conexion = await getConexionDeOwner(user.id, supabaseAdmin)
  if (!conexion) return res.status(400).json({ error: 'Primero conectá tu cuenta de Mercado Pago' })

  const { data: local } = await supabaseAdmin
    .from('locales').select('nombre, direccion, ciudad, provincia, latitud, longitud').eq('id', localId).maybeSingle()
  if (!local) return res.status(404).json({ error: 'Local no encontrado' })
  if (!local.direccion || !local.ciudad || !local.provincia) {
    return res.status(400).json({ error: 'Este local todavía no tiene dirección cargada' })
  }

  // Mercado Pago exige lat/long para crear la Sucursal, y valida city_name/state_name
  // contra un catálogo geográfico real (un typo del dueño hace que MP rechace la
  // Sucursal). Por eso siempre geocodificamos la dirección y usamos el nombre oficial
  // que devuelve, en vez de confiar en lo que se tipeó a mano.
  const ubicacion = await geocodificarDireccion(local)
  if (!ubicacion) {
    return res.status(400).json({
      error: 'No pudimos ubicar esa dirección automáticamente. Revisá que esté bien escrita (con número, ciudad y provincia) e intentá de nuevo.',
    })
  }
  const { latitud, longitud, ciudad, provincia } = ubicacion
  await supabaseAdmin.from('locales').update({ latitud, longitud, ciudad, provincia }).eq('id', localId)

  try {
    const accessToken = await tokenVigente(supabaseAdmin, conexion)
    const externalStoreId = derivarExternalStoreId(localId)
    const externalPosId = derivarExternalPosId(localId, 1)

    const storeId = await resolverStore({
      mpUserId: conexion.mp_user_id,
      accessToken,
      externalStoreId,
      nombreLocal: local.nombre,
      local: { ...local, latitud, longitud, ciudad, provincia },
    })

    const posId = await resolverPos({ accessToken, externalPosId, externalStoreId, storeId })

    const mapeo = await guardarMapeo(supabaseAdmin, {
      localId,
      mpStoreId: String(storeId),
      mpPosId: String(posId),
    })

    // Backfill de los últimos días (Fase C): best-effort — si falla, el local
    // queda igual vinculado, los cobros nuevos van a llegar por webhook y el
    // cron periódico va a terminar de completar lo viejo.
    const hasta = new Date()
    const desde = new Date(hasta.getTime() - DIAS_BACKFILL_INICIAL * 24 * 60 * 60 * 1000)
    sincronizarCuenta(supabaseAdmin, { ...conexion, access_token: accessToken }, {
      desde: desde.toISOString(), hasta: hasta.toISOString(),
    }).catch((err) => console.error('Backfill inicial de Mercado Pago falló (el local sigue vinculado igual)', err))

    return res.status(200).json(mapeo)
  } catch (err) {
    console.error('Error vinculando local con Mercado Pago', err)
    return res.status(502).json({ error: `Mercado Pago no confirmó la vinculación: ${err.message}` })
  }
}

async function resolverStore({ mpUserId, accessToken, externalStoreId, nombreLocal, local }) {
  const encontrada = await buscarStore(mpUserId, accessToken, externalStoreId)
  const existente = encontrada?.results?.[0]
  if (existente) return existente.id

  const location = {
    street_name: local.direccion,
    city_name: local.ciudad,
    state_name: local.provincia,
    ...(local.latitud != null && local.longitud != null ? { latitude: local.latitud, longitude: local.longitud } : {}),
  }

  try {
    const creada = await crearStore(mpUserId, accessToken, { name: nombreLocal, externalId: externalStoreId, location })
    return creada.id
  } catch (err) {
    // MP valida city_name/state_name contra un catálogo propio y rechaza por
    // diferencias de mayúsculas/minúsculas (ej. "Tres de Febrero" vs la forma
    // que ellos esperan, "Tres de febrero"). El error trae la lista completa
    // de valores válidos — si el nuestro está ahí con otro casing, lo
    // corregimos y reintentamos una sola vez en vez de fallar por eso.
    const descripcion = err.causes?.[0]?.description
    const ciudadCorregida = extraerValorValidoDelError(descripcion, location.city_name)
    if (!ciudadCorregida || ciudadCorregida === location.city_name) throw err

    console.log(`Reintentando Store con city_name corregido: "${location.city_name}" -> "${ciudadCorregida}"`)
    const creada = await crearStore(mpUserId, accessToken, {
      name: nombreLocal,
      externalId: externalStoreId,
      location: { ...location, city_name: ciudadCorregida },
    })
    return creada.id
  }
}

async function resolverPos({ accessToken, externalPosId, externalStoreId, storeId }) {
  const encontrado = await buscarPos(accessToken, externalPosId)
  const existente = encontrado?.results?.[0]
  if (existente) return existente.id

  const creado = await crearPos(accessToken, {
    name: 'Caja 1',
    storeId,
    externalStoreId,
    externalId: externalPosId,
  })
  return creado.id
}

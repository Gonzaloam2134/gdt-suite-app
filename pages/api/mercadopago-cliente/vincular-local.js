import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { buscarStore, crearStore, buscarPos, crearPos } from '../../../lib/server/mercadopagoCliente'
import { tokenVigente } from '../../../lib/server/mercadopagoClienteAuth'
import { sincronizarCuenta, DIAS_BACKFILL_INICIAL } from '../../../lib/server/mercadopagoClienteSync'
import { getConexionDeOwner } from '../../../lib/services/conexionesMercadopago'
import { guardarMapeo } from '../../../lib/services/mapeoLocalesMp'
import { derivarExternalStoreId, derivarExternalPosId } from '../../../lib/domain/mercadopagoCliente'

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

  try {
    const accessToken = await tokenVigente(supabaseAdmin, conexion)
    const externalStoreId = derivarExternalStoreId(localId)
    const externalPosId = derivarExternalPosId(localId, 1)

    const storeId = await resolverStore({
      mpUserId: conexion.mp_user_id,
      accessToken,
      externalStoreId,
      nombreLocal: local.nombre,
      local,
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

  const creada = await crearStore(mpUserId, accessToken, {
    name: nombreLocal,
    externalId: externalStoreId,
    location: {
      street_name: local.direccion,
      city_name: local.ciudad,
      state_name: local.provincia,
      ...(local.latitud != null && local.longitud != null ? { latitude: local.latitud, longitude: local.longitud } : {}),
    },
  })
  return creada.id
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

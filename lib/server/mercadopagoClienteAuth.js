import { refrescarTokens } from './mercadopagoCliente'
import { actualizarTokens, getConexionDeOwner } from '../services/conexionesMercadopago'
import { logEvento } from './logger'

const MARGEN_RENOVACION_MS = 24 * 60 * 60 * 1000
// Por si la respuesta de MP no trae expires_in: el access_token dura 180 días (confirmado en el plan).
const VENCIMIENTO_MS_POR_DEFECTO = 180 * 24 * 60 * 60 * 1000

const vigente = (c) => c && new Date(c.vence_en).getTime() - Date.now() > MARGEN_RENOVACION_MS

/**
 * Devuelve un access_token vigente para esta conexión, renovándolo (y
 * guardando el refresh_token NUEVO — el viejo deja de servir) si está a
 * menos de un día de vencer. Lo usan vincular-local, el webhook y el cron:
 * todos hablan con la cuenta del comerciante y ninguno tiene una sesión de
 * usuario para pedirle que vuelva a conectar si se venció.
 *
 * El refresh_token es de un solo uso (MP lo rota en cada renovación). Si dos
 * de estos tres procesos lo disparan casi al mismo tiempo para la misma
 * conexión, el que llega segundo a Mercado Pago con la copia vieja del
 * refresh_token va a fallar — no porque el access_token siga sin renovarse,
 * sino porque el OTRO proceso ya lo consumió primero. No hay forma barata de
 * tomar un lock que dure todo el viaje de ida y vuelta a la API de MP (eso sí
 * sería infraestructura de más para este caso), así que en vez de eso: si la
 * renovación falla, se vuelve a leer la conexión — si ya está vigente (el
 * que ganó la carrera ya la actualizó), se usa esa, sin reintentar contra MP.
 */
export async function tokenVigente(cliente, conexion) {
  if (vigente(conexion)) return conexion.access_token

  try {
    const token = await renovar(cliente, conexion)
    logEvento({ operacion: 'refresh_token_mp', resultado: 'renovado', ownerId: conexion.owner_id })
    return token
  } catch (err) {
    const fresca = await getConexionDeOwner(conexion.owner_id, cliente).catch(() => null)
    if (fresca && fresca.refresh_token !== conexion.refresh_token && vigente(fresca)) {
      logEvento({ operacion: 'refresh_token_mp', resultado: 'recuperado_de_carrera', ownerId: conexion.owner_id })
      return fresca.access_token
    }
    logEvento({ operacion: 'refresh_token_mp', resultado: 'fallido', ownerId: conexion.owner_id, error: err })
    throw err
  }
}

async function renovar(cliente, conexion) {
  const tokens = await refrescarTokens(conexion.refresh_token)
  const nuevoVenceEn = new Date(
    Date.now() + (tokens.expires_in ? tokens.expires_in * 1000 : VENCIMIENTO_MS_POR_DEFECTO)
  ).toISOString()

  await actualizarTokens(cliente, conexion.owner_id, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    venceEn: nuevoVenceEn,
  })

  return tokens.access_token
}

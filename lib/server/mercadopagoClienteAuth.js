import { refrescarTokens } from './mercadopagoCliente'
import { actualizarTokens } from '../services/conexionesMercadopago'

const MARGEN_RENOVACION_MS = 24 * 60 * 60 * 1000
// Por si la respuesta de MP no trae expires_in: el access_token dura 180 días (confirmado en el plan).
const VENCIMIENTO_MS_POR_DEFECTO = 180 * 24 * 60 * 60 * 1000

/**
 * Devuelve un access_token vigente para esta conexión, renovándolo (y
 * guardando el refresh_token NUEVO — el viejo deja de servir) si está a
 * menos de un día de vencer. Lo usan vincular-local, el webhook y el cron:
 * todos hablan con la cuenta del comerciante y ninguno tiene una sesión de
 * usuario para pedirle que vuelva a conectar si se venció.
 */
export async function tokenVigente(cliente, conexion) {
  const venceEn = new Date(conexion.vence_en).getTime()
  if (venceEn - Date.now() > MARGEN_RENOVACION_MS) return conexion.access_token

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

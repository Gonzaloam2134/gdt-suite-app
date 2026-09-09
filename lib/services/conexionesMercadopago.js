import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

/**
 * `conexiones_mercadopago` tiene RLS que bloquea todo acceso desde el
 * cliente (son credenciales de una cuenta ajena) — estas funciones solo
 * sirven si se llaman con el cliente Service Role (lib/server/supabaseAdmin).
 * Igual viven en lib/services/ porque son el único lugar con `supabase.from()`
 * para esta tabla, tal como pide CLAUDE.md.
 */

export const getConexionDeOwner = (ownerId, cliente = supabase) =>
  cliente.from('conexiones_mercadopago').select('*').eq('owner_id', ownerId).is('desconectado_en', null).maybeSingle().then(unwrap)

export const guardarConexion = (cliente, { ownerId, mpUserId, accessToken, refreshToken, venceEn }) =>
  cliente.from('conexiones_mercadopago')
    .upsert([{
      owner_id: ownerId,
      mp_user_id: mpUserId,
      access_token: accessToken,
      refresh_token: refreshToken,
      vence_en: venceEn,
      desconectado_en: null,
    }], { onConflict: 'owner_id' })
    .select().single().then(unwrap)

export const actualizarTokens = (cliente, ownerId, { accessToken, refreshToken, venceEn }) =>
  cliente.from('conexiones_mercadopago')
    .update({ access_token: accessToken, refresh_token: refreshToken, vence_en: venceEn })
    .eq('owner_id', ownerId).then(unwrap)

export const desconectar = (cliente, ownerId) =>
  cliente.from('conexiones_mercadopago')
    .update({ desconectado_en: new Date().toISOString() })
    .eq('owner_id', ownerId).then(unwrap)

/** Cooldown del botón "Sincronizar" del dashboard — ver pages/api/mercadopago-cliente/sincronizar.js. */
export const marcarSincronizacionManual = (cliente, ownerId) =>
  cliente.from('conexiones_mercadopago')
    .update({ ultima_sincronizacion_manual: new Date().toISOString() })
    .eq('owner_id', ownerId).then(unwrap)

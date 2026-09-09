import { supabase } from '../supabaseClient'
import { unwrap } from './_base'

export const getMapeoDeLocal = (localId) =>
  supabase.from('mapeo_locales_mp').select('*').eq('local_id', localId).maybeSingle().then(unwrap)

export const getMapeosDeLocales = (localIds) =>
  supabase.from('mapeo_locales_mp').select('*').in('local_id', localIds).then(unwrap)

/** Se llama con el cliente Service Role desde pages/api/mercadopago-cliente/vincular-local.js — el dueño no escribe esta tabla directo, la completa el server tras hablar con la API de MP. */
export const guardarMapeo = (cliente, { localId, mpStoreId, mpPosId }) =>
  cliente.from('mapeo_locales_mp')
    .upsert([{ local_id: localId, mp_store_id: mpStoreId, mp_pos_id: mpPosId }], { onConflict: 'local_id' })
    .select().single().then(unwrap)

/**
 * Todos los locales que un dueño ya vinculó — para resolverLocalId (webhook
 * y sincronización): hace falta la lista completa para poder comparar el
 * external_pos_id de un order contra la de cada local, o para aplicar el
 * autocompletado de "un solo local, sin ambigüedad" (Point y transferencias).
 * Se llama con Service Role (el webhook no tiene sesión de usuario).
 */
export const listarMapeosDeOwner = (cliente, ownerId) =>
  cliente.from('mapeo_locales_mp')
    .select('local_id, mp_store_id, mp_pos_id, locales!inner(creado_por)')
    .eq('locales.creado_por', ownerId)
    .then(unwrap)

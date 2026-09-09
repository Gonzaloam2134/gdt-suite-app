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

export const buscarPorStoreYPos = (mpStoreId, mpPosId) =>
  supabase.from('mapeo_locales_mp').select('*').eq('mp_store_id', mpStoreId).eq('mp_pos_id', mpPosId).maybeSingle().then(unwrap)

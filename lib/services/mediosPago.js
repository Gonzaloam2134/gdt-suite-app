import { supabase } from '../supabaseClient'
import { unwrap } from './_base'
import { iconoMedio } from '../constants/mediosPago'

const CAMPOS = 'id, nombre, tipo, icono, comision_porcentaje, plazo_acreditacion_dias, habilitado, es_default, orden'

export const listarMediosPago = (localId, { soloHabilitados = false } = {}) => {
  let q = supabase.from('medios_pago').select(CAMPOS).eq('local_id', localId).order('orden', { ascending: true })
  if (soloHabilitados) q = q.eq('habilitado', true)
  return q.then(unwrap)
}

export const crearMedioPago = ({ localId, nombre, tipo, comision = 0, plazo = 0, creadoPor, orden = 0, esDefault = false }) =>
  supabase.from('medios_pago').insert([{
    local_id: localId, nombre, tipo, icono: iconoMedio(tipo),
    comision_porcentaje: comision, plazo_acreditacion_dias: plazo,
    habilitado: true, es_default: esDefault, orden, creado_por: creadoPor,
  }]).select(CAMPOS).single().then(unwrap)

export const crearMediosPago = (localId, medios, creadoPor) =>
  supabase.from('medios_pago').insert(medios.map((m, i) => ({
    local_id: localId, nombre: m.nombre, tipo: m.tipo, icono: iconoMedio(m.tipo),
    comision_porcentaje: m.comision, plazo_acreditacion_dias: m.plazo,
    habilitado: true, es_default: true, orden: i, creado_por: creadoPor,
  }))).then(unwrap)

export const actualizarMedioPago = (id, cambios) =>
  supabase.from('medios_pago').update(cambios).eq('id', id).then(unwrap)

export const setMedioHabilitado = (id, habilitado) => actualizarMedioPago(id, { habilitado })

export const eliminarMedioPago = (id) =>
  supabase.from('medios_pago').delete().eq('id', id).then(unwrap)

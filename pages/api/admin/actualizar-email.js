import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'

/**
 * Cambia el email de LOGIN de una cuenta (auth.users), no solo el que se
 * muestra en la app. Necesita la Service Role: cambiar credenciales de
 * acceso es algo que la RLS normal nunca deja hacer desde el navegador,
 * ni siquiera a un super admin logueado — con buena razón.
 *
 * Solo lo puede pedir alguien con rol_global = 'super_user'.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: { user: quienLlama }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !quienLlama) return res.status(401).json({ error: 'No autenticado' })

  const { data: perfilLlamador } = await supabaseAdmin
    .from('perfiles').select('rol_global').eq('id', quienLlama.id).maybeSingle()
  if (perfilLlamador?.rol_global !== 'super_user') {
    return res.status(403).json({ error: 'Solo un super admin puede hacer esto' })
  }

  const { userId, nuevoEmail } = req.body || {}
  if (!userId || !nuevoEmail || !/\S+@\S+\.\S+/.test(nuevoEmail)) {
    return res.status(400).json({ error: 'Email inválido' })
  }

  // Guardamos el email anterior ANTES de pisarlo — sin esto, el registro de
  // auditoría diría solo "se cambió a X", sin poder mostrar nunca desde
  // dónde. Best-effort: si esto falla, seguimos igual con el cambio real.
  const { data: perfilAnterior } = await supabaseAdmin
    .from('perfiles').select('email').eq('id', userId).maybeSingle()

  // 1. El cambio real: la credencial de login en auth.users.
  //    email_confirm:true lo marca como ya verificado — es un cambio hecho
  //    por un admin, no tiene sentido mandarle un mail de confirmación a
  //    una casilla que la persona puede ni revisar en el momento.
  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: nuevoEmail,
    email_confirm: true,
  })
  if (authUpdateError) {
    return res.status(400).json({ error: authUpdateError.message || 'No se pudo actualizar el email de acceso' })
  }

  // Se registra ACÁ, apenas se confirma el cambio real — no al final, para
  // que quede constancia aunque el paso 2 (sincronizar perfiles) falle.
  await supabaseAdmin.from('logs_auditoria_global').insert({
    actor_id: quienLlama.id,
    accion: 'email_actualizado',
    objetivo_id: userId,
    detalles: { emailAnterior: perfilAnterior?.email ?? null, emailNuevo: nuevoEmail },
  }).then(({ error }) => {
    if (error) console.error('No se pudo registrar en la auditoría global (el cambio de email sí se aplicó)', error)
  })

  // 2. Mantener perfiles.email sincronizado — es lo que se muestra en toda
  //    la app (listas de miembros, superadmin, etc.), y no se actualiza
  //    solo cuando cambia el de auth.users.
  const { error: perfilUpdateError } = await supabaseAdmin
    .from('perfiles').update({ email: nuevoEmail }).eq('id', userId)
  if (perfilUpdateError) {
    // El login ya cambió (paso 1 fue exitoso) — avisamos igual que el
    // reflejo en perfiles no se actualizó, para no ocultar el desvío.
    return res.status(207).json({
      warning: 'El email de acceso se actualizó, pero no se pudo reflejar en el perfil. Revisar manualmente.',
      detalle: perfilUpdateError.message,
    })
  }

  return res.status(200).json({ ok: true })
}

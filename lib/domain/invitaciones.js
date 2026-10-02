/**
 * Reglas puras sobre invitaciones. Sin React, sin Supabase.
 * estado queda en 'pendiente' en la base hasta que alguien intenta aceptarla
 * (aceptar_invitacion la pasa a 'expirada' recién en ese momento) — así que
 * una invitación vencida sin intentos de aceptación sigue 'pendiente' para
 * siempre en la columna estado. Por eso el cupo no puede confiar solo en
 * estado: tiene que mirar también expira_en, igual que ya hace ver_invitacion().
 */
export const invitacionVigente = (inv) =>
  inv.estado === 'pendiente' && new Date(inv.expira_en) > new Date()

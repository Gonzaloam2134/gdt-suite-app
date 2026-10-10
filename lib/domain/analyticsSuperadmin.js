/**
 * Agregaciones puras para el panel de análisis del superadmin: por local,
 * por owner y por medio de pago, más señales simples de salud de cuenta.
 * Sin React ni Supabase — recibe filas ya traídas y agrega. No inventa
 * datos que no vinieron en las filas (mismo criterio que los reportes
 * fiscales de CLAUDE.md): si falta algo, el campo queda en 0/null, nunca
 * se estima.
 */

import { TIPO_TX } from '../constants/transacciones'

/**
 * Agrupa transacciones por local_id. Una reversa o una transacción
 * `revertida` no suma a los totales (igual que en el arqueo de caja), pero
 * ambas cuentan como "actividad" para `ultimaActividad` — un local que solo
 * tuvo reversas en estos días no está en silencio, solo no vendió neto.
 */
export const agruparTransaccionesPorLocal = (transacciones) => {
  const porLocal = new Map()

  for (const t of transacciones) {
    if (!t.local_id) continue
    if (!porLocal.has(t.local_id)) {
      porLocal.set(t.local_id, {
        localId: t.local_id,
        movimientos: 0,
        cobros: 0,
        gastos: 0,
        volumenCobrado: 0,
        volumenGastado: 0,
        reversas: 0,
        conComprobante: 0,
        sinComprobante: 0,
        ultimaActividad: null,
      })
    }
    const acc = porLocal.get(t.local_id)

    if (!acc.ultimaActividad || t.creado_en > acc.ultimaActividad) acc.ultimaActividad = t.creado_en

    if (t.es_reversa) { acc.reversas += 1; continue }
    if (t.revertida) continue

    acc.movimientos += 1
    const monto = Number(t.monto) || 0

    if (t.tipo === TIPO_TX.COBRO) {
      acc.cobros += 1
      acc.volumenCobrado += monto
      if (t.comprobante_path) acc.conComprobante += 1
      else acc.sinComprobante += 1
    } else if (t.tipo === TIPO_TX.GASTO) {
      acc.gastos += 1
      acc.volumenGastado += monto
    }
  }

  return Array.from(porLocal.values()).map((acc) => ({
    ...acc,
    ticketPromedioCobro: acc.cobros ? acc.volumenCobrado / acc.cobros : 0,
    pctReversas: (acc.movimientos + acc.reversas) ? acc.reversas / (acc.movimientos + acc.reversas) : 0,
    pctSinComprobante: acc.cobros ? acc.sinComprobante / acc.cobros : 0,
  }))
}

/**
 * El owner de un local es el miembro activo con rol 'owner' (CLAUDE.md:
 * una persona tiene el mismo rol en todos sus locales, validado por
 * trigger). Un local sin owner activo queda con ownerId null — se agrupa
 * aparte en vez de ocultarse o adjudicarse a cualquiera.
 */
export const ownerPorLocal = (locales) => {
  const mapa = new Map()
  for (const local of locales) {
    const miembroOwner = (local.miembros_locales || []).find((m) => m.rol === 'owner' && m.activo !== false)
    mapa.set(local.id, {
      ownerId: miembroOwner?.user_id || null,
      ownerEmail: miembroOwner?.perfiles?.email || null,
      ownerNombre: miembroOwner?.perfiles?.nombre || null,
    })
  }
  return mapa
}

/**
 * Agrupa las estadísticas por local (ya agregadas con `agruparTransaccionesPorLocal`)
 * por owner, para el panel "por owner" del superadmin.
 */
export const agruparPorOwner = (statsPorLocal, locales) => {
  const ownerMap = ownerPorLocal(locales)
  const nombrePorLocal = new Map(locales.map((l) => [l.id, l.nombre]))
  const porOwner = new Map()

  for (const stat of statsPorLocal) {
    const owner = ownerMap.get(stat.localId) || {}
    const key = owner.ownerId || `sin-owner:${stat.localId}`

    if (!porOwner.has(key)) {
      porOwner.set(key, {
        ownerId: owner.ownerId || null,
        ownerEmail: owner.ownerEmail || null,
        ownerNombre: owner.ownerNombre || null,
        locales: [],
        movimientos: 0,
        volumenCobrado: 0,
        volumenGastado: 0,
      })
    }

    const acc = porOwner.get(key)
    acc.locales.push({ ...stat, nombre: nombrePorLocal.get(stat.localId) || 'Sin nombre' })
    acc.movimientos += stat.movimientos
    acc.volumenCobrado += stat.volumenCobrado
    acc.volumenGastado += stat.volumenGastado
  }

  return Array.from(porOwner.values()).sort((a, b) => b.volumenCobrado - a.volumenCobrado)
}

/**
 * Agrupa cobros por tipo de medio de pago (el `tipo` del medio, no su id:
 * los ids son por local, el tipo — efectivo/tarjeta/etc. — es lo comparable
 * entre locales distintos). Requiere que la fila venga con el join a
 * medios_pago (ver lib/services/transacciones.js).
 */
export const agruparPorTipoMedioPago = (transacciones) => {
  const porTipo = new Map()

  for (const t of transacciones) {
    if (t.es_reversa || t.revertida || t.tipo !== TIPO_TX.COBRO) continue
    const tipo = t.medios_pago?.tipo || 'sin_medio'

    if (!porTipo.has(tipo)) porTipo.set(tipo, { tipo, movimientos: 0, volumen: 0 })
    const acc = porTipo.get(tipo)
    acc.movimientos += 1
    acc.volumen += Number(t.monto) || 0
  }

  return Array.from(porTipo.values()).sort((a, b) => b.volumen - a.volumen)
}

/**
 * Locales sin ninguna actividad (ni una reversa) en los últimos
 * `diasInactividad` días. Es una señal para mirar primero, no un
 * diagnóstico de abandono — un local nuevo sin movimientos todavía también
 * cae acá.
 */
export const localesInactivos = (statsPorLocal, diasInactividad = 14, ahora = new Date()) =>
  statsPorLocal.filter((s) => {
    if (!s.ultimaActividad) return true
    const dias = (ahora - new Date(s.ultimaActividad)) / (1000 * 60 * 60 * 24)
    return dias >= diasInactividad
  })

/**
 * Suscripciones activas que vencen dentro de `diasAviso` días (y las ya
 * vencidas no incluidas aquí: esas ya las marca el badge "VENCIDO" en la
 * pestaña Suscripciones existente).
 */
export const suscripcionesPorVencerPronto = (suscripciones, diasAviso = 7, ahora = new Date()) =>
  suscripciones.filter((s) => {
    if (s.estado !== 'active' || !s.fecha_vencimiento) return false
    const dias = (new Date(s.fecha_vencimiento) - ahora) / (1000 * 60 * 60 * 24)
    return dias >= 0 && dias <= diasAviso
  })

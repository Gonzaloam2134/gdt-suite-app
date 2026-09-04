/**
 * Cashflow del negocio (lo que le entra a GDT Suite, no a un local
 * particular). Todo acá es puro: sin fetch, sin Supabase — recibe los datos
 * ya cargados y devuelve números.
 */

const claveDelMes = (fechaISO) => fechaISO.slice(0, 7) // 'YYYY-MM'

const sumarMeses = (anio, mes, delta) => {
  const idx = (mes - 1) + delta
  const y = anio + Math.floor(idx / 12)
  const m = (idx % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

/** Agrupa pagos ya cobrados (historial real) por mes calendario. */
export const agruparPagosPorMes = (pagos) => {
  const mapa = {}
  for (const p of pagos) {
    const clave = claveDelMes(p.procesado_en)
    mapa[clave] = (mapa[clave] || 0) + Number(p.monto)
  }
  return mapa
}

/**
 * Proyecta, mes a mes, cuánto debería entrar de las suscripciones que HOY
 * están activas y pagas — asumiendo que nadie cancela ni falla ningún cobro
 * en el medio. Es una proyección optimista, no una promesa: cualquier baja
 * o pago rechazado la va a hacer errar para arriba.
 *
 * @param {Array} suscripciones  filas con { estado, plan, segmento, ciclo, monto, fecha_vencimiento }
 * @param {number} meses         cuántos meses hacia adelante, incluyendo el actual
 * @param {string} hoy           'YYYY-MM-DD', para tests determinísticos
 */
export const proyectarCashflow = (suscripciones, meses = 6, hoy = new Date().toISOString().slice(0, 10)) => {
  const [anioHoy, mesHoy] = hoy.split('-').map(Number)

  const proyeccion = {}
  for (let i = 0; i < meses; i++) proyeccion[sumarMeses(anioHoy, mesHoy, i)] = 0

  const activas = suscripciones.filter(s => s.plan === 'pago' && s.estado === 'active' && s.fecha_vencimiento && s.monto)

  for (const sub of activas) {
    const [vAnio, vMes] = sub.fecha_vencimiento.split('-').map(Number)
    const monto = Number(sub.monto)

    if (sub.ciclo === 'mensual') {
      for (let i = 0; i < meses; i++) {
        const clave = sumarMeses(vAnio, vMes, i)
        if (clave in proyeccion) proyeccion[clave] += monto
      }
    } else if (sub.ciclo === 'anual') {
      const clave = `${vAnio}-${String(vMes).padStart(2, '0')}`
      if (clave in proyeccion) proyeccion[clave] += monto
    }
  }

  return proyeccion
}

/** Total de lo ya cobrado, sin importar el mes — para un número grande arriba del gráfico. */
export const totalCobradoHistorico = (pagos) => pagos.reduce((acc, p) => acc + Number(p.monto), 0)

/** Ingreso recurrente mensual actual: suma de lo que cobran hoy las suscripciones mensuales activas + 1/12 de las anuales. */
export const mrrActual = (suscripciones) => {
  const activas = suscripciones.filter(s => s.plan === 'pago' && s.estado === 'active' && s.monto)
  return activas.reduce((acc, s) => acc + (s.ciclo === 'anual' ? Number(s.monto) / 12 : Number(s.monto)), 0)
}

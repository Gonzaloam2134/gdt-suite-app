/**
 * Logging estructurado mínimo para operaciones críticas de servidor (no
 * para código de cliente). Una línea JSON por evento — sin librería nueva,
 * alcanza para que se pueda grepear/filtrar en los logs de Vercel.
 *
 * NUNCA pasar acá nada de esto, ni dentro de `detalles`: access_token,
 * refresh_token, cualquier campo que contenga "secret", "password" o
 * "token" se descarta automáticamente (ver CAMPOS_SENSIBLES).
 */
const CAMPOS_SENSIBLES = ['token', 'secret', 'password', 'credencial']

const esCampoSensible = (clave) => CAMPOS_SENSIBLES.some((p) => clave.toLowerCase().includes(p))

const limpiar = (detalles) => {
  if (!detalles || typeof detalles !== 'object') return undefined
  const limpio = {}
  for (const [clave, valor] of Object.entries(detalles)) {
    if (esCampoSensible(clave)) continue
    limpio[clave] = valor
  }
  return limpio
}

/**
 * @param {object} datos
 * @param {string} datos.operacion   ej. 'webhook_mp', 'sincronizacion_mp', 'refresh_token_mp'
 * @param {string} datos.resultado   ej. 'recibido' | 'rechazado' | 'procesado' | 'fallido' | 'iniciado' | 'terminado'
 * @param {string} [datos.ownerId]
 * @param {string} [datos.localId]
 * @param {string} [datos.requestId]
 * @param {number} [datos.duracionMs]
 * @param {Error|string} [datos.error]
 * @param {object} [datos.detalles]  cualquier otro dato no sensible (cantidades, ids de MP, etc.)
 */
export function logEvento({ operacion, resultado, ownerId, localId, requestId, duracionMs, error, detalles }) {
  const linea = {
    ts: new Date().toISOString(),
    operacion,
    resultado,
    ...(ownerId ? { ownerId } : {}),
    ...(localId ? { localId } : {}),
    ...(requestId ? { requestId } : {}),
    ...(duracionMs != null ? { duracionMs } : {}),
    ...(error ? { error: typeof error === 'string' ? error : error.message } : {}),
    ...limpiar(detalles),
  }
  const esError = resultado === 'fallido' || resultado === 'rechazado' || !!error
  ;(esError ? console.error : console.log)(JSON.stringify(linea))
}

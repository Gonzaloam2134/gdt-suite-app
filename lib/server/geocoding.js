/**
 * Geocodifica una dirección de texto a lat/long + nombre oficial de ciudad/provincia
 * usando Nominatim (OpenStreetMap), gratuito y sin API key.
 *
 * Se usa SIEMPRE antes de crear una Sucursal en Mercado Pago, no solo cuando falta
 * lat/long: MP valida `location.city_name` / `location.state_name` contra un catálogo
 * geográfico real, así que un typo del dueño ("villa boch" en vez de "Villa Bosch")
 * hace que MP rechace la Sucursal con "invalid". Usando el nombre que devuelve la
 * geocodificación en vez del texto tipeado evitamos ese rechazo.
 *
 * Nominatim pide un User-Agent identificable y no más de ~1 request/segundo por IP —
 * volumen más que suficiente para vincular locales uno a la vez.
 */
export const geocodificarDireccion = async ({ direccion, ciudad, provincia }) => {
  const query = `${direccion}, ${ciudad}, ${provincia}, Argentina`
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'GDTSuite/1.0 (contacto: supportfranquicias@gmail.com)' },
  })
  if (!res.ok) return null

  const data = await res.json().catch(() => null)
  const resultado = data?.[0]
  if (!resultado) return null

  const latitud = parseFloat(resultado.lat)
  const longitud = parseFloat(resultado.lon)
  if (Number.isNaN(latitud) || Number.isNaN(longitud)) return null

  const dir = resultado.address || {}
  console.log('Geocodificación OSM — address completo:', JSON.stringify(dir))

  // Confirmado con datos reales (ver log de arriba): en el conurbano bonaerense
  // Nominatim da el BARRIO como "town"/"suburb" (ej. "Villa Bosch"), pero Mercado
  // Pago rechaza eso como city_name — necesita el PARTIDO, que es la división
  // administrativa real. Nominatim lo pone en "state_district" como
  // "Partido de X" / "Departamento de X". Por eso ese campo va primero,
  // limpiando el prefijo; el resto queda como fallback para direcciones fuera
  // del conurbano, donde sí hay una "city" real reconocida por Nominatim.
  const partido = dir.state_district?.replace(/^(Partido|Departamento) de /i, '')
  const ciudadOficial = partido || dir.city || dir.town || dir.village || dir.municipality || dir.county || dir.suburb || ciudad
  const provinciaOficial = dir.state || provincia

  return { latitud, longitud, ciudad: ciudadOficial, provincia: provinciaOficial }
}

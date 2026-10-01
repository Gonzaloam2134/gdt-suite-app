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

  // Nominatim no siempre llena "city" (localidades chicas vienen como "town",
  // "village", o en el conurbano bonaerense el barrio aparece como "suburb" y
  // el partido como "county"/"municipality") — probamos en orden de
  // especificidad y si no hay nada usamos lo que escribió el dueño, mejor eso
  // que dejar el campo vacío.
  const ciudadOficial = dir.city || dir.town || dir.village || dir.municipality || dir.county || dir.suburb || ciudad
  const provinciaOficial = dir.state || provincia

  return { latitud, longitud, ciudad: ciudadOficial, provincia: provinciaOficial }
}

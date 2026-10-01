/**
 * Geocodifica una dirección de texto a lat/long usando Nominatim (OpenStreetMap),
 * gratuito y sin API key. Se usa como respaldo del servidor cuando el navegador
 * no pudo dar la ubicación (permiso denegado, no soportado, timeout): Mercado
 * Pago exige coordenadas para crear la Sucursal de un local, no alcanza con la
 * dirección en texto.
 *
 * Nominatim pide un User-Agent identificable y no más de ~1 request/segundo
 * por IP — volumen más que suficiente para vincular locales uno a la vez.
 */
export const geocodificarDireccion = async ({ direccion, ciudad, provincia }) => {
  const query = `${direccion}, ${ciudad}, ${provincia}, Argentina`
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`

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

  return { latitud, longitud }
}

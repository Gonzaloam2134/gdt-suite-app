const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
  // Nunca cachear Supabase: es plata en tiempo real, no shell de la app.
  // Como *.supabase.co es otro origen, el service worker no lo intercepta
  // salvo que se lo digamos explícitamente — por eso NO hay una regla para
  // ese dominio acá. Solo se cachean assets propios (JS/CSS/imágenes) para
  // que la app abra rápido y funcione sin conexión; las pantallas igual
  // necesitan red para leer o guardar datos reales.
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'imagenes', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } },
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'estaticos' },
    },
    {
      // Documentos (páginas HTML): red primero, así siempre se ve la versión
      // más nueva cuando hay conexión; el caché es solo la salida de emergencia
      // sin señal, no la fuente de verdad.
      urlPattern: ({ request }) => request.destination === 'document',
      handler: 'NetworkFirst',
      options: { cacheName: 'paginas', networkTimeoutSeconds: 4, expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 } },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = withPWA(nextConfig)

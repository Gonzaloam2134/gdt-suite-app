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

  // Headers de seguridad básicos, presentes en cualquier app tomada en
  // serio. El Content-Security-Policy queda afuera a propósito: hay que
  // armarlo con cuidado (Supabase, Mercado Pago, Google Fonts) y probarlo
  // bien antes de activarlo en una app que ya mueve plata real — uno mal
  // configurado puede romper el checkout o el login sin avisar.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // No embeber la app dentro de un iframe ajeno (clickjacking).
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // El navegador no debe "adivinar" el tipo de un archivo distinto
          // al que el servidor declaró.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // No filtrar la URL completa de origen al navegar hacia afuera
          // (por ejemplo, al link de Mercado Pago en el checkout).
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Apaga cámara/micrófono/pago por API del navegador que la app no
          // usa. La geolocalización queda permitida SOLO para el propio
          // origen — la necesita el flujo de conectar Mercado Pago del
          // cliente (pedir la ubicación del local).
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), geolocation=(self)' },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)

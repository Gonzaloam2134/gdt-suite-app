import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="es-AR">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e3a5f" />

        {/* Ícono estándar y favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />

        {/* iOS: Safari no lee manifest.json para instalar, necesita esto aparte */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GDT Suite" />

        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="GDT Suite" />
        <meta name="description" content="Control de caja diaria, cobros, gastos y reportes para comercios de barrio." />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

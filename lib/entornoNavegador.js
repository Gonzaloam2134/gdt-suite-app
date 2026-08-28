/**
 * Detección de entorno del navegador para la instalación de la PWA.
 * Basado en el user agent — no es infalible (los navegadores mienten en el
 * UA a propósito), pero cubre los casos reales: los navegadores embebidos de
 * WhatsApp, Instagram y Facebook no soportan instalar una PWA. El botón de
 * instalar (beforeinstallprompt) directamente no aparece ahí, así que sin
 * este aviso el usuario busca algo que no existe y se frustra en silencio.
 */

export const esNavegadorEmbebido = (ua = '') => (
  /FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(ua)
)

export const esIOS = (ua = '') => /iPhone|iPad|iPod/i.test(ua) && !window.MSStream

export const esAndroid = (ua = '') => /Android/i.test(ua)

export const esChrome = (ua = '') => /Chrome/i.test(ua) && !/Edg|OPR|SamsungBrowser/i.test(ua)

export const esSafari = (ua = '') => /Safari/i.test(ua) && !/Chrome|Chromium|CriOS/i.test(ua)

/** Ya está instalada y corriendo como app (no como pestaña del navegador) */
export const corriendoInstalada = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

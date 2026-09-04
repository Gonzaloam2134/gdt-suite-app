import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getStatsGlobales, listarUsuarios, listarLocalesConMiembros, getConfigGlobal, listarPagosSuscripcion } from '../lib/services/superadmin'
import { listarContactosConDetalle } from '../lib/services/contactos'
import { listarSuscripcionesConOwner } from '../lib/services/suscripciones'
import { listarAnuncios } from '../lib/services/anuncios'
import { listarPlanes } from '../lib/services/planes'

const CONFIG_DEFAULT = {
  max_locales_por_usuario: 10,
  comision_default: 2.5,
  plazo_acreditacion_default: 30,
  mantenimiento_activo: false,
}

/**
 * Datos del panel de super admin: stats globales, contactos, usuarios,
 * locales, suscripciones, config y anuncios.
 *
 * Cada sección se carga y se falla por separado (`Promise.allSettled`, no
 * `Promise.all`): un problema puntual en, por ejemplo, la tabla de anuncios
 * no debe vaciar el panel entero — las otras seis secciones ya cargaron o van
 * a cargar igual. Antes esto era un solo `Promise.all` con un try/catch
 * general: cualquier sección que fallara tiraba abajo TODO el resultado,
 * incluidas las que sí habían respondido bien.
 */
export function useSuperAdminData() {
  const [globalStats, setGlobalStats] = useState({ locales: 0, usuarios: 0, transacciones: 0 })
  const [contactos, setContactos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [todosLosLocales, setTodosLosLocales] = useState([])
  const [suscripciones, setSuscripciones] = useState([])
  const [config, setConfig] = useState(CONFIG_DEFAULT)
  const [anuncios, setAnuncios] = useState([])
  const [planes, setPlanes] = useState([])
  const [pagosSuscripcion, setPagosSuscripcion] = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)

    const [stats, contactosData, usuariosData, localesData, suscripcionesData, configData, anunciosData, planesData, pagosData] =
      await Promise.allSettled([
        getStatsGlobales(),
        listarContactosConDetalle(),
        listarUsuarios(),
        listarLocalesConMiembros(),
        listarSuscripcionesConOwner(),
        getConfigGlobal(),
        listarAnuncios({ soloActivos: false }),
        listarPlanes(),
        listarPagosSuscripcion(),
      ])

    if (stats.status === 'fulfilled') setGlobalStats(stats.value)
    else { console.error('[useSuperAdminData] stats', stats.reason); toast.error('No se pudieron cargar las estadísticas globales') }

    if (contactosData.status === 'fulfilled') setContactos(contactosData.value)
    else { console.error('[useSuperAdminData] contactos', contactosData.reason); toast.error('No se pudieron cargar las consultas') }

    if (usuariosData.status === 'fulfilled') setUsuarios(usuariosData.value)
    else { console.error('[useSuperAdminData] usuarios', usuariosData.reason); toast.error('No se pudieron cargar los usuarios') }

    if (localesData.status === 'fulfilled') setTodosLosLocales(localesData.value)
    else { console.error('[useSuperAdminData] locales', localesData.reason); toast.error('No se pudieron cargar los locales') }

    if (suscripcionesData.status === 'fulfilled') setSuscripciones(suscripcionesData.value)
    else { console.error('[useSuperAdminData] suscripciones', suscripcionesData.reason); toast.error('No se pudieron cargar las suscripciones') }

    // Sin toast: si la tabla de configuración todavía no existe en este
    // entorno, se sigue con los valores por defecto en vez de interrumpir.
    if (configData.status === 'fulfilled' && configData.value) setConfig(configData.value)
    else if (configData.status === 'rejected') console.error('[useSuperAdminData] config', configData.reason)

    if (anunciosData.status === 'fulfilled') setAnuncios(anunciosData.value)
    else { console.error('[useSuperAdminData] anuncios', anunciosData.reason); toast.error('No se pudieron cargar los anuncios') }

    if (planesData.status === 'fulfilled') setPlanes(planesData.value)
    else { console.error('[useSuperAdminData] planes', planesData.reason); toast.error('No se pudieron cargar los precios de los planes') }

    if (pagosData.status === 'fulfilled') setPagosSuscripcion(pagosData.value)
    else { console.error('[useSuperAdminData] pagosSuscripcion', pagosData.reason); toast.error('No se pudo cargar el historial de pagos') }

    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { globalStats, contactos, usuarios, todosLosLocales, suscripciones, config, setConfig, anuncios, planes, pagosSuscripcion, loading, recargar: cargar }
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { cambiarEstadoSuscripcion, cambiarEstadoCuenta } from '../lib/services/suscripciones'
import { responderContacto } from '../lib/services/contactos'
import { actualizarUsuario, guardarConfigGlobal } from '../lib/services/superadmin'
import { actualizarPrecioPlan } from '../lib/services/planes'
import { crearAnuncio, actualizarAnuncio, cambiarActivoAnuncio, eliminarAnuncio } from '../lib/services/anuncios'
import { useSuperAdminData } from './useSuperAdminData'

export function useSuperAdminManager() {
  const router = useRouter()
  const {
    globalStats, contactos, usuarios, todosLosLocales, suscripciones,
    config, setConfig, anuncios, planes, pagosSuscripcion, auditoriaGlobal, loading, recargar,
  } = useSuperAdminData()

  // Tab state
  const [activeTab, setActiveTab] = useState('dashboard')

  // Tab scrolling logic
  const tabsScrollRef = useRef(null)
  const [tabsPuedeIzq, setTabsPuedeIzq] = useState(false)
  const [tabsPuedeDer, setTabsPuedeDer] = useState(false)

  const actualizarSombrasTabs = useCallback(() => {
    const el = tabsScrollRef.current
    if (!el) return
    setTabsPuedeIzq(el.scrollLeft > 4)
    setTabsPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    actualizarSombrasTabs()
    const t = setTimeout(actualizarSombrasTabs, 150)
    window.addEventListener('resize', actualizarSombrasTabs)
    return () => { clearTimeout(t); window.removeEventListener('resize', actualizarSombrasTabs) }
  }, [actualizarSombrasTabs])

  const desplazarTabs = (dir) => tabsScrollRef.current?.scrollBy({ left: dir * 140, behavior: 'smooth' })

  // Consultas
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [respondiendoId, setRespondiendoId] = useState(null)
  const [respuestaTexto, setRespuestaTexto] = useState('')

  const handleResponderContacto = async (contactoId) => {
    if (!respuestaTexto.trim()) return toast.error('Escribí una respuesta')
    try {
      await responderContacto(contactoId, respuestaTexto.trim())
      toast.success('✅ Respuesta enviada')
      setRespondiendoId(null)
      setRespuestaTexto('')
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  // Usuarios
  const [editandoUsuario, setEditandoUsuario] = useState(null)
  const [nuevoRol, setNuevoRol] = useState('')
  const [editandoEmail, setEditandoEmail] = useState(null)
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [confirmarEmail, setConfirmarEmail] = useState(null)
  const [guardandoEmail, setGuardandoEmail] = useState(false)

  const handleActualizarUsuario = async (userId) => {
    if (!nuevoRol) return
    try {
      await actualizarUsuario(userId, { rol_global: nuevoRol })
      toast.success('✅ Usuario actualizado')
      setEditandoUsuario(null)
      setNuevoRol('')
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const confirmarCambioEmail = async () => {
    if (!confirmarEmail) return
    setGuardandoEmail(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/actualizar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: confirmarEmail.id, nuevoEmail: confirmarEmail.emailNuevo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo cambiar el email')
      if (data?.warning) {
        toast(data.warning)
      } else {
        toast.success('Email actualizado — ya puede iniciar sesión con el nuevo')
      }
      setEditandoEmail(null); setNuevoEmail(''); setConfirmarEmail(null)
      await recargar()
    } catch (err) {
      toast.error(err.message || 'Error al cambiar el email')
    } finally {
      setGuardandoEmail(false)
    }
  }

  // Locales
  const [filtroLocal, setFiltroLocal] = useState('')
  const [confirmarLocal, setConfirmarLocal] = useState(null)

  const confirmarSuspenderLocal = async () => {
    if (!confirmarLocal) return
    try {
      await cambiarEstadoSuscripcion(confirmarLocal.id, confirmarLocal.suspendido ? 'active' : 'suspended')
      toast.success(`✅ Local ${confirmarLocal.suspendido ? 'activado' : 'suspendido'} correctamente`)
      setConfirmarLocal(null)
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  // Suscripciones
  const [filtroSuscripcion, setFiltroSuscripcion] = useState('todos')
  const [confirmarSuscripcion, setConfirmarSuscripcion] = useState(null)

  const confirmarCambioSuscripcion = async () => {
    if (!confirmarSuscripcion) return
    try {
      await cambiarEstadoCuenta(confirmarSuscripcion.ownerId, confirmarSuscripcion.nuevoEstado)
      toast.success(`✅ Estado actualizado a ${confirmarSuscripcion.nuevoEstado}`)
      setConfirmarSuscripcion(null)
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  // Config
  const handleGuardarConfig = async () => {
    try {
      await guardarConfigGlobal(config)
      toast.success('✅ Configuración guardada')
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const [preciosEditando, setPreciosEditando] = useState({})
  const [guardandoPrecio, setGuardandoPrecio] = useState(null)

  const handleGuardarPrecio = async (plan) => {
    const nuevoValor = preciosEditando[plan.id]
    const precio = Number(nuevoValor)
    if (!Number.isFinite(precio) || precio < 0) return toast.error('Ingresá un precio válido')
    setGuardandoPrecio(plan.id)
    try {
      await actualizarPrecioPlan(plan.segmento, plan.ciclo, precio)
      toast.success(`Plan actualizado`)
      await recargar()
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar el precio')
    } finally {
      setGuardandoPrecio(null)
    }
  }

  // Anuncios
  const [nuevoAnuncio, setNuevoAnuncio] = useState({ titulo: '', mensaje: '', tipo: 'info' })
  const [editandoAnuncio, setEditandoAnuncio] = useState(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [aEliminarAnuncio, setAEliminarAnuncio] = useState(null)
  const [publicando, setPublicando] = useState(false)

  const handleCrearAnuncio = async () => {
    if (!nuevoAnuncio.titulo.trim() || !nuevoAnuncio.mensaje.trim()) return toast.error('Completá título y mensaje')
    setPublicando(true)
    try {
      await crearAnuncio({ ...nuevoAnuncio, creadoPor: 'superadmin' }) // Fallback since we don't have user.id here yet
      toast.success('✅ Anuncio publicado')
      setNuevoAnuncio({ titulo: '', mensaje: '', tipo: 'info' })
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally { setPublicando(false) }
  }

  const handleGuardarEdicion = async () => {
    if (!editandoAnuncio.titulo.trim() || !editandoAnuncio.mensaje.trim()) return toast.error('Completá título y mensaje')
    setGuardandoEdicion(true)
    try {
      await actualizarAnuncio(editandoAnuncio.id, editandoAnuncio)
      toast.success('Anuncio actualizado')
      setEditandoAnuncio(null)
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally { setGuardandoEdicion(false) }
  }

  const handleToggleActivo = async (anuncio) => {
    try {
      await cambiarActivoAnuncio(anuncio.id, !anuncio.activo)
      toast.success(anuncio.activo ? 'Anuncio ocultado' : 'Anuncio reactivado')
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleEliminarAnuncio = async () => {
    try {
      await eliminarAnuncio(aEliminarAnuncio.id)
      toast.success('Anuncio eliminado')
      setAEliminarAnuncio(null)
      await recargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  return {
    // Data
    globalStats, contactos, usuarios, todosLosLocales, suscripciones,
    config, setConfig, anuncios, planes, pagosSuscripcion, auditoriaGlobal, loading, recargar,

    // Tabs
    activeTab, setActiveTab, tabsScrollRef, tabsPuedeIzq, tabsPuedeDer, desplazarTabs,

    // Consultas
    filtroEstado, setFiltroEstado, respondiendoId, setRespondiendoId, respuestaTexto, setRespuestaTexto, handleResponderContacto,

    // Usuarios
    editandoUsuario, setEditandoUsuario, nuevoRol, setNuevoRol, handleActualizarUsuario,
    editandoEmail, setEditandoEmail, nuevoEmail, setNuevoEmail, confirmarEmail, setConfirmarEmail, guardandoEmail, confirmarCambioEmail,

    // Locales
    filtroLocal, setFiltroLocal, confirmarLocal, setConfirmarLocal, confirmarSuspenderLocal,

    // Suscripciones
    filtroSuscripcion, setFiltroSuscripcion, confirmarSuscripcion, setConfirmarSuscripcion, confirmarCambioSuscripcion,

    // Config
    handleGuardarConfig, preciosEditando, setPreciosEditando, guardandoPrecio, handleGuardarPrecio,

    // Anuncios
    nuevoAnuncio, setNuevoAnuncio, editandoAnuncio, setEditandoAnuncio, guardandoEdicion, aEliminarAnuncio, setAEliminarAnuncio, publicando,
    handleCrearAnuncio, handleGuardarEdicion, handleToggleActivo, handleEliminarAnuncio,

    router
  }
}

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useUserRole } from '../lib/UserRoleContext'
import { useMisLocales } from '../hooks/useMisLocales'
import { useResumenLocales } from '../hooks/useResumenLocales'
import { useAnuncios } from '../hooks/useAnuncios'
import { crearLocal } from '../lib/services/locales'
import { agregarOwner } from '../lib/services/miembros'
import { crearMediosPago } from '../lib/services/mediosPago'
import { crearSuscripcionPrueba, getSuscripcion } from '../lib/services/suscripciones'
import { estadoEfectivo } from '../lib/domain/suscripciones'
import { registrarAccion } from '../lib/services/auditoria'
import { ACCIONES } from '../lib/constants/auditoria'
import { ROLES } from '../lib/constants/roles'

import LoadingScreen from '../components/ui/LoadingScreen'
import EmptyState from '../components/ui/EmptyState'
import AppHeader from '../components/layout/AppHeader'
import BottomNav from '../components/layout/BottomNav'
import LocalCard from '../components/locales/LocalCard'
import ResumenGlobal from '../components/locales/ResumenGlobal'
import AnunciosModal from '../components/locales/AnunciosModal'
import OnboardingWizard from '../components/OnboardingWizard'
import ContactModal from '../components/ContactModal'

/** Pantalla de inicio: cómo viene el día en cada local y desde dónde se entra a todo. */
export default function MisLocales() {
  const router = useRouter()
  const { user, checking } = useAuthGuard()
  const { cambiarLocal } = useUserRole()
  const { locales, cargado, recargar } = useMisLocales(user?.id)
  const { resumen, abiertas, totales } = useResumenLocales(locales)
  const { pendientes, cargado: anunciosCargados, marcarComoLeidos } = useAnuncios(user?.id)

  const [indiceAnuncio, setIndiceAnuncio] = useState(0)
  const [verAnuncios, setVerAnuncios] = useState(false)
  const [onboarding, setOnboarding] = useState(false)
  const [contacto, setContacto] = useState(false)
  const [suscripciones, setSuscripciones] = useState({})

  useEffect(() => {
    if (anunciosCargados && pendientes.length > 0) { setIndiceAnuncio(0); setVerAnuncios(true) }
  }, [anunciosCargados, pendientes.length])

  // Estado de suscripción de cada local: define si se puede entrar
  useEffect(() => {
    if (!locales.length) return
    Promise.all(locales.map(l => getSuscripcion(l.id).then(s => [l.id, s]).catch(() => [l.id, null])))
      .then(pares => setSuscripciones(Object.fromEntries(pares)))
  }, [locales])

  if (checking || !cargado) return <LoadingScreen mensaje="Cargando tus locales…" icono="🏪" />

  const cerrarAnuncios = async () => {
    setVerAnuncios(false)
    await marcarComoLeidos(pendientes.map(a => a.id))
  }

  const entrar = async (local, destino = '/dashboard') => {
    const { estado, vencioPrueba } = estadoEfectivo(suscripciones[local.id])
    if (estado === 'suspended') {
      toast.error(vencioPrueba ? 'Tu prueba de 30 días terminó. Escribinos para seguir usando este local.' : 'Local suspendido. Regularizá el pago para acceder.')
      return
    }
    await cambiarLocal(local.id)
    if (estado === 'restricted') {
      toast('Acceso restringido: solo podés ver Reportes.', { icon: '⚠️' })
      router.push('/reportes')
      return
    }
    router.push(destino)
  }

  const crear = async (datos) => {
    try {
      const local = await crearLocal({
        nombre: datos.businessName?.trim() || 'Mi negocio',
        rubro: datos.rubro || 'Otro',
        condicionFiscal: datos.condicionFiscal || 'Consumidor Final',
        creadoPor: user.id,
      })
      await agregarOwner(local.id, user.id)
      await crearSuscripcionPrueba(local.id, 30)

      const medios = (datos.mediosPago || []).filter(m => m.habilitado)
      if (medios.length) await crearMediosPago(local.id, medios, user.id)

      await registrarAccion({ localId: local.id, userId: user.id, accion: ACCIONES.LOCAL_CREADO, detalles: { nombre: local.nombre } })

      toast.success('Local creado')
      await cambiarLocal(local.id)
      setOnboarding(false)
      await recargar()
      router.push('/dashboard')
    } catch (err) {
      toast.error(`No se pudo crear el local: ${err.message}`)
    }
  }

  const puedeCrear = locales.length === 0 || locales.some(l => l.rol === ROLES.OWNER)

  return (
    <main className="min-h-screen bg-slate-100 pb-20 md:pb-8">
      <AppHeader titulo="Mis locales" locales={locales} localId={null} />

      <div className="max-w-5xl mx-auto p-3 md:p-4 space-y-4">
        <ResumenGlobal totales={totales} cantidadLocales={locales.length} cantidadAbiertas={abiertas.size} />

        {locales.length === 0 ? (
          <EmptyState
            icono="🏪"
            titulo="Todavía no tenés ningún local"
            descripcion="Creá el primero para empezar a registrar la caja del día."
            accion={
              <button onClick={() => setOnboarding(true)}
                className="px-5 py-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">
                Crear mi primer local
              </button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {locales.map(local => {
                const sub = estadoEfectivo(suscripciones[local.id])
                return (
                  <LocalCard
                    key={local.id}
                    local={local}
                    resumen={resumen[local.id]}
                    cajaAbierta={abiertas.has(local.id)}
                    onEntrar={() => entrar(local)}
                    onAdmin={local.rol === ROLES.OWNER ? () => entrar(local, '/admin') : null}
                    deshabilitado={sub.estado === 'suspended'}
                    motivo={sub.estado === 'suspended'
                      ? (sub.vencioPrueba ? 'Tu prueba de 30 días terminó.' : 'Local suspendido por falta de pago.')
                      : null}
                    diasRestantesPrueba={sub.diasRestantes}
                  />
                )
              })}
            </div>

            {puedeCrear && (
              <button onClick={() => setOnboarding(true)}
                className="w-full p-3 bg-white text-blue-700 border-2 border-dashed border-blue-300 rounded-xl text-sm font-bold cursor-pointer hover:bg-blue-50">
                + Agregar otro local
              </button>
            )}
          </>
        )}

        <button onClick={() => setContacto(true)}
          className="w-full p-3 bg-transparent text-gray-500 border-none text-xs cursor-pointer hover:text-gray-700">
          ¿Necesitás ayuda? Escribinos
        </button>
      </div>

      {verAnuncios && pendientes.length > 0 && (
        <AnunciosModal
          anuncios={pendientes}
          indice={indiceAnuncio}
          onSiguiente={() => setIndiceAnuncio(i => i + 1)}
          onCerrar={cerrarAnuncios}
        />
      )}

      {onboarding && (
        <OnboardingWizard
          onComplete={crear}
          onCancel={() => setOnboarding(false)}
          skipScaleStep={locales.length > 0}
        />
      )}

      <ContactModal isOpen={contacto} onClose={() => setContacto(false)} user={user} paginaOrigen="locales" />
      <BottomNav activeTab="inicio" />
    </main>
  )
}
// Force new build

import { useState } from 'react'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useUserRole } from '../lib/UserRoleContext'
import { useActiveLocal } from '../hooks/useActiveLocal'
import { useRouter } from 'next/router'
import { useSuscripcionGuard } from '../hooks/useSuscripcionGuard'
import { useTerminosGuard } from '../hooks/useTerminosGuard'
import { useCaja } from '../hooks/useCaja'
import { useTransaccionesDia } from '../hooks/useTransaccionesDia'
import { hoyISO, aFechaISO } from '../lib/dates'
import { useMisLocales } from '../hooks/useMisLocales'
import { marcarBienvenidaVista } from '../lib/services/auth'

import LoadingScreen from '../components/ui/LoadingScreen'
import BottomNav from '../components/layout/BottomNav'
import AppHeader from '../components/layout/AppHeader'
import FechaNav from '../components/caja/FechaNav'
import EstadoCaja from '../components/caja/EstadoCaja'
import AvisoCajaHuerfana from '../components/caja/AvisoCajaHuerfana'
import CajaAcciones from '../components/caja/CajaAcciones'
import KpiCards from '../components/caja/KpiCards'
import ResumenDiaPasado from '../components/caja/ResumenDiaPasado'
import ListaTransacciones from '../components/caja/ListaTransacciones'
import AcreditacionesDelDia from '../components/caja/AcreditacionesDelDia'
import DesgloseMedios from '../components/caja/DesgloseMedios'
import ModalesCaja from '../components/caja/ModalesCaja'
import SinLocalSeleccionado from '../components/caja/SinLocalSeleccionado'
import BienvenidaModal from '../components/BienvenidaModal'
import TerminosBloqueoModal from '../components/TerminosBloqueoModal'
import PorConfirmarMp from '../components/dashboard/PorConfirmarMp'

export default function Dashboard() {
  const router = useRouter()
  const { user, checking } = useAuthGuard()
  const terminos = useTerminosGuard(user?.id)
  const { local, localId, loading: cargandoLocal } = useActiveLocal(user)
  const { esSuperUser, loading: cargandoRol, role, perfil, userId, recargar: recargarRol } = useUserRole()
  // El super admin no queda bloqueado por la suscripción de un local: la
  // administra desde /superadmin. OJO: hay que esperar a que el rol termine de
  // cargar antes de decidir esto — `esSuperUser` arranca en `false` mientras
  // `UserRoleContext` no resolvió la sesión, y mirarlo solo a él dejaba pasar
  // una carrera que podía echar a un super admin real del local que revisaba.
  const suscripcion = useSuscripcionGuard(cargandoRol ? null : (esSuperUser ? null : localId), 'total')
  const { locales } = useMisLocales(user?.id)
  const [fechaISO, setFechaISO] = useState(hoyISO())
  const esHoyVista = fechaISO === hoyISO()

  const { totales, cobros, gastos, acreditacionesHoy, desgloseMedios, loading, recargar } =
    useTransaccionesDia(localId, fechaISO)

  // Una sola tira cronológica con cobros, gastos y sus reversas.
  const movimientos = [
    ...cobros.map(c => ({ ...c, tipoMovimiento: 'cobro' })),
    ...gastos.map(g => ({ ...g, tipoMovimiento: 'gasto' })),
  ].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))

  const caja = useCaja({ localId, userId: user?.id, onCambio: recargar })

  // Totales del día de la caja huérfana (si hay una), para cerrarla con los
  // números de SU día y no con los de hoy.
  const diaHuerfanaISO = caja.huerfana ? aFechaISO(new Date(caja.huerfana.fecha_apertura)) : null
  const datosHuerfana = useTransaccionesDia(caja.huerfana ? localId : null, diaHuerfanaISO || fechaISO)

  const [modal, setModal] = useState(null)   // apertura | cierre | cierre-huerfana | historial | cobro | gasto | ayuda | guia | editar-inicial
  // Primera vez que esta persona llega a la caja: se marca en la cuenta, no
  // en el dispositivo, para que no vuelva a aparecer al entrar desde otro celular.
  const [bienvenidaCerrada, setBienvenidaCerrada] = useState(false)
  const mostrarBienvenida = !cargandoRol && perfil && !perfil.bienvenida_vista_en && !bienvenidaCerrada
  const [aReversar, setAReversar] = useState(null)
  const cerrarModal = () => setModal(null)

  if (checking || cargandoRol || cargandoLocal || suscripcion.checking || suscripcion.debeRedirigir || terminos.checking) return <LoadingScreen mensaje="Cargando caja…" />
  if (terminos.debeAceptar) return <TerminosBloqueoModal isOpen onAceptar={terminos.aceptar} />

  // useActiveLocal ya redirige a /locales cuando no hay local activo; esto es
  // la red de seguridad para cuando ese redirect tarda o se interrumpe.
  if (!localId) return <SinLocalSeleccionado onIr={() => router.replace('/locales')} />
  if (!local) return <LoadingScreen mensaje="Cargando local…" icono="🏪" />

  const abrirHistorial = async () => { if (await caja.cargarHistorial()) setModal('historial') }

  return (
    <main className="min-h-screen bg-fondo pb-24 md:pb-8 md:pl-56">
      <AppHeader
        titulo="Caja" locales={locales} localId={localId} ocultarNavDesktop
        acciones={
          <button onClick={recargar} title="Actualizar" aria-label="Actualizar"
            className="press w-10 h-10 bg-primary-50 text-primary-700 border-none rounded-full text-base cursor-pointer hover:bg-primary-50/70">↻</button>
        }
      />

      <div className="max-w-3xl mx-auto p-3 md:p-6 space-y-4">
        <FechaNav fechaISO={fechaISO} onCambiar={setFechaISO} />

        {esHoyVista && caja.huerfana && (
          <AvisoCajaHuerfana fechaApertura={caja.huerfana.fecha_apertura} onResolver={() => setModal('cierre-huerfana')} />
        )}

        {esHoyVista && (
          <EstadoCaja
            cajaAbierta={caja.cajaAbierta} huerfana={caja.huerfana}
            onAbrir={() => setModal('apertura')} onCerrar={() => setModal('cierre')}
            onHistorial={abrirHistorial} onAyuda={() => setModal('guia')} onEditarInicial={() => setModal('editar-inicial')}
          />
        )}

        {loading ? (
          <p className="text-center text-sm text-gray-500 py-8">Actualizando movimientos…</p>
        ) : (
          <>
            {esHoyVista ? <KpiCards totales={totales} cajaAbierta={caja.cajaAbierta} /> : <ResumenDiaPasado totales={totales} />}
            {esHoyVista && caja.cajaAbierta && <CajaAcciones onCobro={() => setModal('cobro')} onGasto={() => setModal('gasto')} />}
            {esHoyVista && <PorConfirmarMp localId={localId} local={local} />}
            <ListaTransacciones items={movimientos} onReversar={setAReversar} soloLectura={!esHoyVista}
              titulo={esHoyVista ? 'Movimientos de hoy' : 'Movimientos del día'} />
            <AcreditacionesDelDia acreditaciones={acreditacionesHoy} />
            <DesgloseMedios medios={desgloseMedios} />
          </>
        )}
      </div>

      <ModalesCaja
        modal={modal} cerrar={cerrarModal} setModal={setModal} caja={caja} totales={totales}
        datosHuerfana={datosHuerfana} local={local} localId={localId} user={user} recargar={recargar}
        aReversar={aReversar} setAReversar={setAReversar}
      />

      <BienvenidaModal
        isOpen={!!mostrarBienvenida}
        rol={role}
        onClose={() => {
          setBienvenidaCerrada(true)   // se oculta al instante, sin esperar la red
          marcarBienvenidaVista(userId).then(recargarRol).catch(() => {})
        }}
      />

      <BottomNav activeTab="caja" lateral />
    </main>
  )
}

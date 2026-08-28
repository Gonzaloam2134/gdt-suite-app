import { useState } from 'react'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useUserRole } from '../lib/UserRoleContext'
import { useActiveLocal } from '../hooks/useActiveLocal'
import { useSuscripcionGuard } from '../hooks/useSuscripcionGuard'
import { useCaja } from '../hooks/useCaja'
import { useTransaccionesDia } from '../hooks/useTransaccionesDia'
import { hoyISO, aFechaISO } from '../lib/dates'
import { useMisLocales } from '../hooks/useMisLocales'
import { formatFechaLarga } from '../lib/format'

import LoadingScreen from '../components/ui/LoadingScreen'
import BottomNav from '../components/layout/BottomNav'
import AppHeader from '../components/layout/AppHeader'
import EstadoCaja from '../components/caja/EstadoCaja'
import AvisoCajaHuerfana from '../components/caja/AvisoCajaHuerfana'
import CajaAcciones from '../components/caja/CajaAcciones'
import KpiCards from '../components/caja/KpiCards'
import ListaTransacciones from '../components/caja/ListaTransacciones'
import AcreditacionesDelDia from '../components/caja/AcreditacionesDelDia'
import DesgloseMedios from '../components/caja/DesgloseMedios'
import AperturaCajaModal from '../components/caja/AperturaCajaModal'
import CierreCajaModal from '../components/caja/CierreCajaModal'
import CierreCajaAnteriorModal from '../components/caja/CierreCajaAnteriorModal'
import HistorialCierresModal from '../components/caja/HistorialCierresModal'
import MovimientoModal from '../components/MovimientoModal'
import ReversaModal from '../components/ReversaModal'
import ContactModal from '../components/ContactModal'

export default function Dashboard() {
  const { user, checking } = useAuthGuard()
  const { local, localId, loading: cargandoLocal } = useActiveLocal(user)
  const { esSuperUser, loading: cargandoRol } = useUserRole()
  // El super admin no queda bloqueado por la suscripción de un local: la
  // administra desde /superadmin, no tiene sentido que lo eche del panel que
  // usa para revisarlo. OJO: hay que esperar a que el rol termine de cargar
  // antes de decidir esto — `esSuperUser` arranca en `false` mientras
  // `UserRoleContext` todavía no resolvió la sesión, así que mirarlo solo a él
  // dejaba pasar una carrera: si `getSuscripcion` respondía antes que el rol
  // (es una sola consulta contra las tres del contexto), un super admin real
  // podía ser echado del local que estaba revisando antes de que la app se
  // enterara de que era super admin.
  const suscripcion = useSuscripcionGuard(cargandoRol ? null : (esSuperUser ? null : localId), 'total')
  const { locales } = useMisLocales(user?.id)
  const [fechaISO] = useState(hoyISO())

  const { totales, cobros, gastos, acreditacionesHoy, desgloseMedios, transacciones, loading, recargar } =
    useTransaccionesDia(localId, fechaISO)

  const caja = useCaja({ localId, userId: user?.id, onCambio: recargar })

  // Totales del día de la caja huérfana (si hay una), para poder cerrarla con
  // los números de SU día y no con los de hoy.
  const diaHuerfanaISO = caja.huerfana ? aFechaISO(new Date(caja.huerfana.fecha_apertura)) : null
  const datosHuerfana = useTransaccionesDia(caja.huerfana ? localId : null, diaHuerfanaISO || fechaISO)

  const [modal, setModal] = useState(null)   // apertura | cierre | cierre-huerfana | historial | cobro | gasto | ayuda
  const [aReversar, setAReversar] = useState(null)
  const cerrarModal = () => setModal(null)

  if (checking || cargandoRol || cargandoLocal || suscripcion.checking || suscripcion.debeRedirigir) return <LoadingScreen mensaje="Cargando caja…" />
  if (!local) return <LoadingScreen mensaje="Cargando local…" icono="🏪" />

  const abrirHistorial = async () => { if (await caja.cargarHistorial()) setModal('historial') }

  return (
    <main className="min-h-screen bg-slate-100 pb-20 md:pb-8">
      <AppHeader
        titulo="Caja del día"
        subtitulo={formatFechaLarga(fechaISO + 'T12:00:00')}
        locales={locales}
        localId={localId}
        acciones={
          <button onClick={recargar} title="Actualizar"
            className="px-2.5 py-2 bg-blue-50 text-blue-700 border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-blue-100">
            ↻
          </button>
        }
      />

      {caja.huerfana && (
        <AvisoCajaHuerfana fechaApertura={caja.huerfana.fecha_apertura} onResolver={() => setModal('cierre-huerfana')} />
      )}

      <EstadoCaja cajaAbierta={caja.cajaAbierta} onAyuda={() => setModal('ayuda')} />

      <CajaAcciones
        cajaAbierta={caja.cajaAbierta}
        huerfana={caja.huerfana}
        onAbrir={() => setModal('apertura')}
        onCerrar={() => setModal('cierre')}
        onHistorial={abrirHistorial}
        onCobro={() => setModal('cobro')}
        onGasto={() => setModal('gasto')}
      />

      <div className="max-w-6xl mx-auto p-3 md:p-4 space-y-4 md:space-y-6">
        {loading ? (
          <p className="text-center text-sm text-gray-500 py-8">Actualizando movimientos…</p>
        ) : (
          <>
            <KpiCards
              totales={totales}
              cantidadCobros={cobros.filter(c => !c.anulada).length}
              cantidadGastos={gastos.filter(g => !g.anulada).length}
            />
            <ListaTransacciones tipo="cobro" items={cobros} onReversar={setAReversar} />
            <ListaTransacciones tipo="gasto" items={gastos} onReversar={setAReversar} />
            <AcreditacionesDelDia acreditaciones={acreditacionesHoy} />
            <DesgloseMedios medios={desgloseMedios} />
          </>
        )}
      </div>

      <AperturaCajaModal
        isOpen={modal === 'apertura'} onClose={cerrarModal}
        onConfirmar={caja.abrir} procesando={caja.procesando}
      />
      <CierreCajaModal
        isOpen={modal === 'cierre'} onClose={cerrarModal}
        cajaAbierta={caja.cajaAbierta} totales={totales} procesando={caja.procesando}
        onConfirmar={({ efectivoFisico, observaciones }) =>
          caja.cerrar({ efectivoFisico, observaciones, totales, cantidadTransacciones: transacciones.length })}
      />
      <CierreCajaAnteriorModal
        isOpen={modal === 'cierre-huerfana'} onClose={cerrarModal}
        caja={caja.huerfana} totales={datosHuerfana.totales} loading={datosHuerfana.loading} procesando={caja.procesando}
        onConfirmar={(nota) =>
          caja.cerrarHuerfana({ totales: datosHuerfana.totales, cantidadTransacciones: datosHuerfana.transacciones.length, nota })}
      />
      <HistorialCierresModal
        isOpen={modal === 'historial'} onClose={cerrarModal}
        cierres={caja.historial} nombreLocal={local.nombre}
      />

      <MovimientoModal tipo="cobro" isOpen={modal === 'cobro'} onClose={cerrarModal} localId={localId} userId={user?.id} local={local} onSuccess={recargar} />
      <MovimientoModal tipo="gasto" isOpen={modal === 'gasto'} onClose={cerrarModal} localId={localId} userId={user?.id} local={local} onSuccess={recargar} />
      <ReversaModal isOpen={!!aReversar} onClose={() => setAReversar(null)} transaccion={aReversar} userId={user?.id} onReversaExitosa={recargar} />
      <ContactModal isOpen={modal === 'ayuda'} onClose={cerrarModal} user={user} localId={localId} paginaOrigen="dashboard" />

      <BottomNav activeTab="caja" />
    </main>
  )
}

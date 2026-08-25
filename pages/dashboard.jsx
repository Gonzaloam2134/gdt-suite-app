import { useState } from 'react'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useActiveLocal } from '../hooks/useActiveLocal'
import { useCaja } from '../hooks/useCaja'
import { useTransaccionesDia } from '../hooks/useTransaccionesDia'
import { hoyISO, esHoy as esHoyFn } from '../lib/dates'

import LoadingScreen from '../components/ui/LoadingScreen'
import BottomNav from '../components/layout/BottomNav'
import CajaHeader from '../components/caja/CajaHeader'
import CajaAcciones from '../components/caja/CajaAcciones'
import KpiCards from '../components/caja/KpiCards'
import ListaTransacciones from '../components/caja/ListaTransacciones'
import AcreditacionesDelDia from '../components/caja/AcreditacionesDelDia'
import DesgloseMedios from '../components/caja/DesgloseMedios'
import AperturaCajaModal from '../components/caja/AperturaCajaModal'
import CierreCajaModal from '../components/caja/CierreCajaModal'
import HistorialCierresModal from '../components/caja/HistorialCierresModal'
import MovimientoModal from '../components/MovimientoModal'
import ReversaModal from '../components/ReversaModal'
import ContactModal from '../components/ContactModal'

export default function Dashboard() {
  const { user, checking } = useAuthGuard()
  const { local, localId, loading: cargandoLocal } = useActiveLocal(user)
  const [fechaISO] = useState(hoyISO())

  const { totales, cobros, gastos, acreditacionesHoy, desgloseMedios, transacciones, loading, recargar } =
    useTransaccionesDia(localId, fechaISO)

  const caja = useCaja({ localId, userId: user?.id, onCambio: recargar })

  const [modal, setModal] = useState(null)   // apertura | cierre | historial | cobro | gasto | ayuda
  const [aReversar, setAReversar] = useState(null)
  const cerrarModal = () => setModal(null)

  if (checking || cargandoLocal) return <LoadingScreen mensaje="Cargando caja…" />
  if (!local) return <LoadingScreen mensaje="Cargando local…" icono="🏪" />

  const abrirHistorial = async () => { if (await caja.cargarHistorial()) setModal('historial') }

  return (
    <main className="min-h-screen bg-slate-100 pb-20 md:pb-8">
      <CajaHeader
        local={local}
        fechaISO={fechaISO}
        cajaAbierta={caja.cajaAbierta}
        esHoy={esHoyFn(fechaISO)}
        onRefresh={recargar}
        onAyuda={() => setModal('ayuda')}
      />

      <CajaAcciones
        cajaAbierta={caja.cajaAbierta}
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
            <KpiCards totales={totales} cantidadCobros={cobros.length} cantidadGastos={gastos.length} />
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

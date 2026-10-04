import AperturaCajaModal from './AperturaCajaModal'
import CierreCajaModal from './CierreCajaModal'
import CierreCajaAnteriorModal from './CierreCajaAnteriorModal'
import HistorialCierresModal from './HistorialCierresModal'
import GuiaArqueoModal from './GuiaArqueoModal'
import EditarMontoInicialModal from './EditarMontoInicialModal'
import MovimientoModal from '../MovimientoModal'
import ReversaModal from '../ReversaModal'
import ContactModal from '../ContactModal'

/**
 * Todos los modales/sheets de la pantalla de Caja en un solo lugar. Solo
 * composición: el estado (`modal`, `aReversar`) y las acciones viven en la página.
 */
export default function ModalesCaja({ modal, cerrar, caja, totales, datosHuerfana, local, localId, user, recargar, aReversar, setAReversar, setModal }) {
  return (
    <>
      <AperturaCajaModal isOpen={modal === 'apertura'} onClose={cerrar} onConfirmar={caja.abrir} procesando={caja.procesando} />
      <CierreCajaModal
        isOpen={modal === 'cierre'} onClose={cerrar}
        cajaAbierta={caja.cajaAbierta} totales={totales} procesando={caja.procesando}
        onConfirmar={({ efectivoFisico, observaciones }) => caja.cerrar({ efectivoFisico, observaciones })}
        onVerGuia={() => setModal('guia')}
      />
      <CierreCajaAnteriorModal
        isOpen={modal === 'cierre-huerfana'} onClose={cerrar}
        caja={caja.huerfana} totales={datosHuerfana.totales} loading={datosHuerfana.loading} procesando={caja.procesando}
        onConfirmar={(nota) => caja.cerrarHuerfana({ nota })}
      />
      <HistorialCierresModal isOpen={modal === 'historial'} onClose={cerrar} cierres={caja.historial} nombreLocal={local.nombre} />

      <MovimientoModal tipo="cobro" isOpen={modal === 'cobro'} onClose={cerrar} localId={localId} userId={user?.id} local={local} onSuccess={recargar} />
      <MovimientoModal tipo="gasto" isOpen={modal === 'gasto'} onClose={cerrar} localId={localId} userId={user?.id} local={local} onSuccess={recargar} />
      <ReversaModal isOpen={!!aReversar} onClose={() => setAReversar(null)} transaccion={aReversar} userId={user?.id} onReversaExitosa={recargar} />
      <GuiaArqueoModal isOpen={modal === 'guia'} onClose={cerrar} onContactar={() => setModal('ayuda')} />
      <EditarMontoInicialModal
        isOpen={modal === 'editar-inicial'} onClose={cerrar}
        montoActual={caja.cajaAbierta?.monto_inicial_efectivo}
        onGuardar={caja.corregirInicial} procesando={caja.procesando}
      />
      <ContactModal isOpen={modal === 'ayuda'} onClose={cerrar} user={user} localId={localId} paginaOrigen="dashboard" />
    </>
  )
}

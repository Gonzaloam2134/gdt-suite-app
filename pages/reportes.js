import { useState } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useSignOut } from '../hooks/useSignOut'
import { useReportes } from '../hooks/useReportes'
import { useSuscripcionGuard } from '../hooks/useSuscripcionGuard'
import { useTerminosGuard } from '../hooks/useTerminosGuard'

import LoadingScreen from '../components/ui/LoadingScreen'
import AppHeader from '../components/layout/AppHeader'
import BottomNav from '../components/layout/BottomNav'
import SeccionColapsable from '../components/ui/SeccionColapsable'
import ReportGuide from '../components/ReportGuide'
import FiltrosReporte from '../components/reportes/FiltrosReporte'
import AvisosCalidad from '../components/reportes/AvisosCalidad'
import ResumenEjecutivo from '../components/reportes/ResumenEjecutivo'
import TarjetaNegocio from '../components/reportes/TarjetaNegocio'
import ResumenPorAlicuota from '../components/reportes/ResumenPorAlicuota'
import ResumenMedios from '../components/reportes/ResumenMedios'
import ConciliacionCaja from '../components/reportes/ConciliacionCaja'
import TablaLibro from '../components/reportes/TablaLibro'
import TerminosBloqueoModal from '../components/TerminosBloqueoModal'

export default function Reportes() {
  const router = useRouter()
  const signOut = useSignOut()
  const { user, checking } = useAuthGuard()
  const terminos = useTerminosGuard(user?.id)
  const r = useReportes(user?.id)
  // 'solo-reportes': nunca redirige, solo informa. Reportes tiene que quedar
  // siempre accesible aunque la prueba haya vencido o el pago esté al día
  // pero el segmento cambió — es la garantía que definimos con las suscripciones.
  const guard = useSuscripcionGuard(r.localId !== 'todos' ? r.localId : null, 'solo-reportes')
  const [ayuda, setAyuda] = useState(false)
  const [exportando, setExportando] = useState(null)

  if (checking || r.loading || terminos.checking) return <LoadingScreen mensaje="Generando reporte…" icono="reportes" />

  if (terminos.debeAceptar) return <TerminosBloqueoModal isOpen onAceptar={terminos.aceptar} />

  /**
   * jsPDF y ExcelJS pesan bastante y solo hacen falta al exportar,
   * así que se cargan recién cuando el usuario aprieta el botón.
   */
  const exportar = async (formato) => {
    if (!r.localActual || exportando) return
    setExportando(formato)
    try {
      const generar = formato === 'PDF'
        ? (await import('../lib/export/pdf')).generarPDF
        : (await import('../lib/export/excel')).generarExcel
      await generar({
        local: r.localActual, periodo: r.periodo, resumen: r.resumen,
        libroVentas: r.libroVentas, libroCompras: r.libroCompras,
        porAlicuotaVentas: r.porAlicuotaVentas, porAlicuotaCompras: r.porAlicuotaCompras,
        porMedio: r.porMedio, porDia: r.porDia, discriminaIva: r.discriminaIva,
        cierres: r.cierres, conciliacion: r.conciliacion, calidad: r.calidad,
      })
      toast.success(`${formato} descargado`)
    } catch (err) {
      toast.error(`No se pudo generar el ${formato}: ${err.message}`)
    } finally {
      setExportando(null)
    }
  }

  const totalesVentas = { neto: r.resumen.netoGravado, iva: r.resumen.ivaDebitoFiscal, total: r.resumen.totalFacturado }
  const totalesCompras = { neto: r.resumen.gastosOperativos - r.resumen.ivaCreditoGastos, iva: r.resumen.ivaCreditoGastos, total: r.resumen.gastosOperativos }

  return (
    <main className="min-h-screen bg-fondo pb-20 md:pb-8 md:pl-56">
      <AppHeader ocultarNavDesktop
        titulo="Reportes contables"
        locales={r.locales}
        localId={r.localId}
        onCambiarLocal={r.setLocalId}
        permiteTodos
        acciones={
          <div className="flex items-center gap-1.5">
            <button onClick={() => exportar('PDF')} disabled={!!exportando}
              className="px-2.5 py-2 press bg-primary-700 text-white border-none rounded-[14px] text-xs font-semibold cursor-pointer hover:bg-primary-600 disabled:opacity-50">
              {exportando === 'PDF' ? '…' : 'PDF'}
            </button>
            <button onClick={() => exportar('Excel')} disabled={!!exportando}
              className="px-2.5 py-2 bg-emerald-500 text-white border-none rounded-[14px] text-xs font-semibold cursor-pointer hover:bg-emerald-600 disabled:opacity-50">
              {exportando === 'Excel' ? '…' : 'Excel'}
            </button>
            <button onClick={() => setAyuda(true)} title="¿Cómo leer esto?"
              className="px-2.5 py-2 bg-primary-50 text-primary-700 border-none rounded-[14px] text-xs font-semibold cursor-pointer hover:bg-primary-50">
              ?
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto p-3 md:p-4 space-y-4">
        <FiltrosReporte periodo={r.periodo} onPreset={r.aplicarPreset} onFechas={r.aplicarFechas} />

        {guard.estado === 'restricted' && (
          <div className="bg-primary-50 border border-primary-500/30 rounded-[14px] p-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-primary-700 m-0">
              {guard.vencioPrueba
                ? 'Tu prueba de 30 días terminó. Podés ver y exportar tus reportes cuando quieras.'
                : 'Este local tiene el acceso restringido a solo Reportes.'}
            </p>
            <a href="/planes"
              className="text-xs font-bold text-primary-700 bg-white border border-primary-500/30 rounded px-3 py-1.5 hover:bg-primary-50 shrink-0">
              Ver planes →
            </a>
          </div>
        )}

        <AvisosCalidad calidad={r.calidad} />

        {!r.discriminaIva && r.localActual && (
          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-[14px] p-3 m-0">
            {r.localActual.condicion_fiscal === 'Mixto'
              ? 'Los locales seleccionados tienen condiciones fiscales distintas, así que no se discrimina IVA en el consolidado. Elegí un local para ver el detalle fiscal.'
              : `Este local está como ${r.localActual.condicion_fiscal || 'sin condición fiscal definida'}, así que los importes se muestran sin discriminar IVA.`}
          </p>
        )}

        <TarjetaNegocio porDia={r.porDia} periodo={r.periodo} />

        <ResumenEjecutivo resumen={r.resumen} discriminaIva={r.discriminaIva} />

        {r.discriminaIva && (
          <SeccionColapsable titulo="Resumen por alícuota" abiertaPorDefecto={false}>
            <ResumenPorAlicuota ventas={r.porAlicuotaVentas} compras={r.porAlicuotaCompras} />
          </SeccionColapsable>
        )}

        <SeccionColapsable titulo="Medios de pago" abiertaPorDefecto={false}>
          <ResumenMedios porMedio={r.porMedio} totalFacturado={r.resumen.totalFacturado} />
        </SeccionColapsable>

        <SeccionColapsable titulo="Conciliación de caja" abiertaPorDefecto={false}>
          <ConciliacionCaja conciliacion={r.conciliacion} cierres={r.cierres} />
        </SeccionColapsable>

        <SeccionColapsable titulo="Libro IVA Ventas" badge={r.libroVentas.length} abiertaPorDefecto={false}>
          <TablaLibro tipo="ventas" filas={r.libroVentas} totales={totalesVentas} discriminaIva={r.discriminaIva} />
        </SeccionColapsable>
        <SeccionColapsable titulo="Libro IVA Compras" badge={r.libroCompras.length} abiertaPorDefecto={false}>
          <TablaLibro tipo="compras" filas={r.libroCompras} totales={totalesCompras} discriminaIva={r.discriminaIva} />
        </SeccionColapsable>

        <p className="text-xs text-gray-400 text-center m-0">
          Generado a partir de los movimientos cargados en el sistema. No reemplaza la liquidación de un profesional.
        </p>
      </div>

      <ReportGuide isOpen={ayuda} onClose={() => setAyuda(false)} />
      <BottomNav activeTab="reportes" lateral />
    </main>
  )
}

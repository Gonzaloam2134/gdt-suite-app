import { useState } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useSignOut } from '../hooks/useSignOut'
import { useReportes } from '../hooks/useReportes'
import { useSuscripcionGuard } from '../hooks/useSuscripcionGuard'

import LoadingScreen from '../components/ui/LoadingScreen'
import AppHeader from '../components/layout/AppHeader'
import BottomNav from '../components/layout/BottomNav'
import ReportGuide from '../components/ReportGuide'
import FiltrosReporte from '../components/reportes/FiltrosReporte'
import AvisosCalidad from '../components/reportes/AvisosCalidad'
import ResumenEjecutivo from '../components/reportes/ResumenEjecutivo'
import ResumenPorAlicuota from '../components/reportes/ResumenPorAlicuota'
import MediosYConciliacion from '../components/reportes/MediosYConciliacion'
import TablaLibro from '../components/reportes/TablaLibro'

export default function Reportes() {
  const router = useRouter()
  const signOut = useSignOut()
  const { user, checking } = useAuthGuard()
  const r = useReportes(user?.id)
  // 'solo-reportes': nunca redirige, solo informa. Reportes tiene que quedar
  // siempre accesible aunque la prueba haya vencido o el pago esté al día
  // pero el segmento cambió — es la garantía que definimos con las suscripciones.
  const guard = useSuscripcionGuard(r.localId !== 'todos' ? r.localId : null, 'solo-reportes')
  const [ayuda, setAyuda] = useState(false)
  const [exportando, setExportando] = useState(null)

  if (checking || r.loading) return <LoadingScreen mensaje="Generando reporte…" icono="📊" />

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
  const totalesCompras = { neto: r.resumen.gastosOperativos - r.resumen.ivaCreditoFiscal, iva: r.resumen.ivaCreditoFiscal, total: r.resumen.gastosOperativos }

  return (
    <main className="min-h-screen bg-slate-100 pb-20 md:pb-8">
      <AppHeader
        titulo="Reportes contables"
        locales={r.locales}
        localId={r.localId}
        onCambiarLocal={r.setLocalId}
        permiteTodos
        acciones={
          <div className="flex items-center gap-1.5">
            <button onClick={() => exportar('PDF')} disabled={!!exportando}
              className="px-2.5 py-2 bg-amber-500 text-white border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-amber-600 disabled:opacity-50">
              {exportando === 'PDF' ? '…' : 'PDF'}
            </button>
            <button onClick={() => exportar('Excel')} disabled={!!exportando}
              className="px-2.5 py-2 bg-emerald-500 text-white border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-emerald-600 disabled:opacity-50">
              {exportando === 'Excel' ? '…' : 'Excel'}
            </button>
            <button onClick={() => setAyuda(true)} title="¿Cómo leer esto?"
              className="px-2.5 py-2 bg-blue-50 text-blue-700 border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-blue-100">
              ?
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto p-3 md:p-4 space-y-4">
        <FiltrosReporte periodo={r.periodo} onPreset={r.aplicarPreset} onFechas={r.aplicarFechas} />

        {guard.estado === 'restricted' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-blue-900 m-0">
              {guard.vencioPrueba
                ? 'Tu prueba de 30 días terminó. Podés ver y exportar tus reportes cuando quieras.'
                : 'Este local tiene el acceso restringido a solo Reportes.'}
            </p>
            <a href="/planes"
              className="text-xs font-bold text-blue-700 bg-white border border-blue-300 rounded px-3 py-1.5 hover:bg-blue-100 shrink-0">
              Ver planes →
            </a>
          </div>
        )}

        <AvisosCalidad calidad={r.calidad} />

        {!r.discriminaIva && r.localActual && (
          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 m-0">
            {r.localActual.condicion_fiscal === 'Mixto'
              ? 'Los locales seleccionados tienen condiciones fiscales distintas, así que no se discrimina IVA en el consolidado. Elegí un local para ver el detalle fiscal.'
              : `Este local está como ${r.localActual.condicion_fiscal || 'sin condición fiscal definida'}, así que los importes se muestran sin discriminar IVA.`}
          </p>
        )}

        <ResumenEjecutivo resumen={r.resumen} discriminaIva={r.discriminaIva} />

        {r.discriminaIva && <ResumenPorAlicuota ventas={r.porAlicuotaVentas} compras={r.porAlicuotaCompras} />}

        <MediosYConciliacion
          porMedio={r.porMedio} conciliacion={r.conciliacion}
          cierres={r.cierres} totalFacturado={r.resumen.totalFacturado}
        />

        <TablaLibro tipo="ventas" filas={r.libroVentas} totales={totalesVentas} discriminaIva={r.discriminaIva} />
        <TablaLibro tipo="compras" filas={r.libroCompras} totales={totalesCompras} discriminaIva={r.discriminaIva} />

        <p className="text-xs text-gray-400 text-center m-0">
          Generado a partir de los movimientos cargados en el sistema. No reemplaza la liquidación de un profesional.
        </p>
      </div>

      <ReportGuide isOpen={ayuda} onClose={() => setAyuda(false)} />
      <BottomNav activeTab="reportes" />
    </main>
  )
}

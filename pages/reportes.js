import { useState } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useSignOut } from '../hooks/useSignOut'
import { useReportes } from '../hooks/useReportes'

import LoadingScreen from '../components/ui/LoadingScreen'
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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="m-0 text-base md:text-lg font-bold text-gray-900">📊 Reportes contables</h1>
            <p className="mt-0.5 text-xs text-gray-500 truncate m-0">{r.localActual?.nombre || 'Sin locales'}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => exportar('PDF')} disabled={!!exportando}
              className="px-3 py-2 bg-amber-500 text-white border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-amber-600 disabled:opacity-50">
              {exportando === 'PDF' ? 'Generando…' : '📄 PDF'}
            </button>
            <button onClick={() => exportar('Excel')} disabled={!!exportando}
              className="px-3 py-2 bg-emerald-500 text-white border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-emerald-600 disabled:opacity-50">
              {exportando === 'Excel' ? 'Generando…' : '📗 Excel'}
            </button>
            <button onClick={() => setAyuda(true)}
              className="px-3 py-2 bg-blue-100 text-blue-700 border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-blue-200">¿Cómo leer esto?</button>
            <button onClick={() => router.push('/dashboard')}
              className="hidden md:block px-3 py-2 bg-gray-100 text-gray-600 border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-gray-200">← Caja</button>
            <button onClick={signOut}
              className="hidden md:block px-3 py-2 bg-gray-100 text-gray-500 border-none rounded-lg text-xs cursor-pointer hover:bg-gray-200">Salir</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-3 md:p-4 space-y-4">
        <FiltrosReporte
          locales={r.locales} localId={r.localId} onLocal={r.setLocalId}
          periodo={r.periodo} onPreset={r.aplicarPreset} onFechas={r.aplicarFechas}
        />

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

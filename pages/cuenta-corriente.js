import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useUserRole } from '../lib/UserRoleContext'
import { useActiveLocal } from '../hooks/useActiveLocal'
import { useMisLocales } from '../hooks/useMisLocales'
import { useSuscripcionGuard } from '../hooks/useSuscripcionGuard'
import { useTerminosGuard } from '../hooks/useTerminosGuard'
import { useCuentaCorriente } from '../hooks/useCuentaCorriente'
import { listarMediosPago } from '../lib/services/mediosPago'
import { registrarAccion } from '../lib/services/auditoria'
import { ACCIONES } from '../lib/constants/auditoria'
import { formatCurrency } from '../lib/format'

import LoadingScreen from '../components/ui/LoadingScreen'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import AppHeader from '../components/layout/AppHeader'
import BottomNav from '../components/layout/BottomNav'
import SinLocalSeleccionado from '../components/caja/SinLocalSeleccionado'
import TerminosBloqueoModal from '../components/TerminosBloqueoModal'
import NuevoClienteCcModal from '../components/cuentaCorriente/NuevoClienteCcModal'
import MovimientosCcModal from '../components/cuentaCorriente/MovimientosCcModal'

/**
 * Cuentas corrientes: para negocios tipo kiosko escolar, donde se anota el
 * consumo de cada cliente durante el mes y se cobra todo junto al final.
 * Disponible para cualquiera que opera la caja (dueño, cajero, empleado) —
 * no es una pantalla de administración, es parte del día a día.
 */
export default function CuentaCorriente() {
  const router = useRouter()
  const { user, checking } = useAuthGuard()
  const terminos = useTerminosGuard(user?.id)
  const { local, localId, loading: cargandoLocal } = useActiveLocal(user)
  const { locales: misLocales } = useMisLocales(user?.id)
  const { userId } = useUserRole()
  const suscripcion = useSuscripcionGuard(localId, 'total')

  const { clientes, totalAdeudado, cargando, crear, recargar } = useCuentaCorriente(localId)
  const [mediosPago, setMediosPago] = useState([])
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [clienteAbierto, setClienteAbierto] = useState(null)

  useEffect(() => {
    if (!localId) return
    listarMediosPago(localId, { soloHabilitados: true }).then(setMediosPago).catch(() => {})
  }, [localId])

  if (checking || cargandoLocal || suscripcion.checking || suscripcion.debeRedirigir || terminos.checking) {
    return <LoadingScreen mensaje="Cargando…" />
  }
  if (terminos.debeAceptar) return <TerminosBloqueoModal isOpen onAceptar={terminos.aceptar} />
  if (!localId) return <SinLocalSeleccionado onIr={() => router.replace('/locales')} />

  const crearCliente = async (nombre, identificador) => {
    await crear(nombre, identificador, userId)
    await registrarAccion({ localId, userId, accion: ACCIONES.CLIENTE_CC_CREADO, detalles: { nombre } })
  }

  return (
    <main className="min-h-screen bg-fondo pb-20 md:pb-10 md:pl-56">
      <AppHeader titulo="Cuenta corriente" subtitulo={local?.nombre} localId={localId} />

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {clientes.length > 0 && (
          <div className="bg-white rounded-[16px] border border-gray-200 p-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">Total adeudado</span>
            <span className="text-lg font-extrabold text-amber-700">{formatCurrency(totalAdeudado)}</span>
          </div>
        )}

        <Button variant="primary" onClick={() => setNuevoCliente(true)} className="w-full">
          + Nuevo cliente
        </Button>

        {cargando ? (
          <p className="text-sm text-gray-400 text-center py-6">Cargando clientes…</p>
        ) : clientes.length === 0 ? (
          <EmptyState icono="equipo" titulo="Todavía no hay clientes con cuenta corriente"
            descripcion="Agregá uno para empezar a anotar sus consumos — por ejemplo, un alumno del colegio." />
        ) : (
          <ul className="space-y-2 pl-0 list-none">
            {clientes.map(c => (
              <li key={c.id}>
                <button onClick={() => setClienteAbierto(c)}
                  className="w-full p-4 bg-white border border-gray-200 rounded-[16px] flex items-center justify-between gap-3 text-left cursor-pointer hover:border-primary-500/40">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{c.nombre}</div>
                    {c.identificador && <div className="text-xs text-gray-500 truncate">{c.identificador}</div>}
                  </div>
                  <span className={`shrink-0 font-bold ${c.saldo > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                    {c.saldo > 0 ? formatCurrency(c.saldo) : 'Al día'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NuevoClienteCcModal isOpen={nuevoCliente} onClose={() => setNuevoCliente(false)} onCrear={crearCliente} />

      <MovimientosCcModal isOpen={!!clienteAbierto} onClose={() => setClienteAbierto(null)} cliente={clienteAbierto}
        localId={localId} mediosPago={mediosPago} userId={userId} onCambio={recargar} />

      <BottomNav activeTab="cuenta-corriente" lateral cantidadLocales={misLocales.length} />
    </main>
  )
}

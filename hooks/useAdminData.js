import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useUserRole } from '../lib/UserRoleContext'
import { getLocal } from '../lib/services/locales'
import { listarMiembros, listarMiembrosInactivos, listarInvitaciones } from '../lib/services/miembros'
import { listarMediosPago } from '../lib/services/mediosPago'
import { listarTransaccionesPeriodo } from '../lib/services/transacciones'
import { listarLogs } from '../lib/services/auditoria'
import { getSuscripcion } from '../lib/services/suscripciones'
import { calcularResumenPeriodo } from '../lib/domain/transacciones'
import { rangoEntre, periodoRapido } from '../lib/dates'
import { discriminaIva } from '../lib/constants/transacciones'
import { ROLES } from '../lib/constants/roles'

const STATS_VACIAS = { ventas: 0, gastos: 0, transacciones: 0, resultado: 0 }

/** Datos del panel del local: stats del período, miembros, medios de pago y auditoría. */
export function useAdminData() {
  const { role, userId, activeLocalId, loading: cargandoRol } = useUserRole()
  const [periodo, setPeriodo] = useState(() => ({ ...periodoRapido('hoy'), preset: 'hoy' }))
  const [local, setLocal] = useState(null)
  const [stats, setStats] = useState(STATS_VACIAS)
  const [miembros, setMiembros] = useState([])
  const [inactivos, setInactivos] = useState([])
  const [invitaciones, setInvitaciones] = useState([])
  const [mediosPago, setMediosPago] = useState([])
  const [suscripcion, setSuscripcion] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (cargandoRol || !activeLocalId || !role) return
    setLoading(true)
    try {
      const localData = await getLocal(activeLocalId)
      setLocal(localData)

      const { inicio, fin } = rangoEntre(periodo.desde, periodo.hasta)
      const esOwner = role === ROLES.OWNER || role === 'super_user'

      const transacciones = await listarTransaccionesPeriodo([activeLocalId], periodo.desde, periodo.hasta)
      const { resumen } = calcularResumenPeriodo(transacciones, { discriminaIva: discriminaIva(localData?.condicion_fiscal) })
      setStats({
        ventas: resumen.totalFacturado,
        gastos: resumen.gastosOperativos,
        transacciones: resumen.cantidadVentas + resumen.cantidadGastos,
        resultado: resumen.resultadoEjercicio,
      })

      // Owner ve todo el local; cajero y empleado solo su propia actividad
      setLogs(await listarLogs({ localId: activeLocalId, inicio, fin, userId: esOwner ? null : userId }))

      if (esOwner) {
        const [m, inac, inv, mp, sub] = await Promise.all([
          listarMiembros(activeLocalId),
          listarMiembrosInactivos(activeLocalId),
          listarInvitaciones(activeLocalId),
          listarMediosPago(activeLocalId),
          getSuscripcion(activeLocalId),
        ])
        setMiembros(m)
        setInactivos(inac)
        setInvitaciones(inv)
        setMediosPago(mp)
        setSuscripcion(sub)
      }
    } catch (err) {
      console.error('[useAdminData]', err)
      toast.error(`No se pudo cargar el panel: ${err.message}`)
    } finally { setLoading(false) }
  }, [cargandoRol, activeLocalId, role, userId, periodo])

  useEffect(() => { cargar() }, [cargar])

  const aplicarPreset = (preset) => setPeriodo({ ...periodoRapido(preset), preset })
  const aplicarFechas = (desde, hasta) => setPeriodo({ desde, hasta, preset: 'personalizado' })

  return { local, stats, miembros, inactivos, invitaciones, mediosPago, suscripcion, logs, periodo, loading, aplicarPreset, aplicarFechas, recargar: cargar }
}

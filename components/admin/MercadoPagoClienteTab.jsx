import { useState } from 'react'
import toast from 'react-hot-toast'
import { useMercadoPagoCliente } from '../../hooks/useMercadoPagoCliente'
import { setDireccionLocal } from '../../lib/services/locales'
import PendientesMpSinAsignar from './PendientesMpSinAsignar'

/**
 * Conectar la cuenta de Mercado Pago del DUEÑO (una cuenta cubre todos sus
 * locales — ver PLAN_MP_CLIENTE_PARA_CODE.md sección 0) y vincular este
 * local puntual a una Store/POS de esa cuenta.
 *
 * La geolocalización es best-effort: si el navegador no la soporta o el
 * dueño rechaza el permiso, se sigue igual con la dirección escrita a mano
 * y lat/long quedan sin completar — nunca bloquea la conexión.
 */
export default function MercadoPagoClienteTab({ local, localId, ownerId, locales, onCambio }) {
  const { conectado, mapeo, cargando, conectando, vinculando, conectar, vincular } = useMercadoPagoCliente(localId)
  const tieneDireccion = !!(local?.direccion && local?.ciudad && local?.provincia)

  const [form, setForm] = useState({
    direccion: local?.direccion || '',
    ciudad: local?.ciudad || '',
    provincia: local?.provincia || '',
  })
  const [guardandoDireccion, setGuardandoDireccion] = useState(false)

  const pedirUbicacion = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitud: pos.coords.latitude, longitud: pos.coords.longitude }),
        () => resolve(null), // permiso rechazado o falló: seguimos sin lat/long, no bloquea
        { timeout: 8000 }
      )
    })

  const guardarDireccionYConectar = async () => {
    if (!form.direccion.trim() || !form.ciudad.trim() || !form.provincia.trim()) {
      toast.error('Completá dirección, ciudad y provincia')
      return
    }
    setGuardandoDireccion(true)
    try {
      const ubicacion = await pedirUbicacion()
      await setDireccionLocal(localId, {
        direccion: form.direccion.trim(),
        ciudad: form.ciudad.trim(),
        provincia: form.provincia.trim(),
        latitud: ubicacion?.latitud,
        longitud: ubicacion?.longitud,
      })
      await onCambio?.()
      await conectar()
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar la dirección')
    } finally {
      setGuardandoDireccion(false)
    }
  }

  if (cargando) return <p className="text-sm text-gray-500">Cargando…</p>

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-base font-bold text-gray-900 m-0">Mercado Pago</h2>
        <p className="text-sm text-gray-600 m-0">
          Conectá la cuenta de Mercado Pago del comercio para que los cobros con QR y Point
          lleguen a una cola de "por confirmar" acá en GDT Suite. Nada se carga solo a la caja:
          vos o tu equipo confirman cada cobro con un toque.
        </p>

        {!conectado && !tieneDireccion && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500 m-0">
              Mercado Pago pide la dirección del local para crear la Sucursal asociada a los cobros.
            </p>
            <input placeholder="Dirección" value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Ciudad" value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
              <input placeholder="Provincia" value={form.provincia}
                onChange={(e) => setForm({ ...form, provincia: e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <p className="text-xs text-gray-400 m-0">
              Te vamos a pedir tu ubicación del navegador para completarlo mejor — si no la das, seguimos igual.
            </p>
            <button onClick={guardarDireccionYConectar} disabled={guardandoDireccion}
              className="w-full p-2.5 bg-blue-500 text-white border-none rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
              {guardandoDireccion ? 'Guardando…' : 'Guardar y conectar Mercado Pago'}
            </button>
          </div>
        )}

        {!conectado && tieneDireccion && (
          <button onClick={conectar} disabled={conectando}
            className="w-full p-2.5 bg-blue-500 text-white border-none rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
            {conectando ? 'Conectando…' : 'Conectar Mercado Pago'}
          </button>
        )}

        {conectado && !mapeo && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <p className="text-sm text-green-700 m-0">✓ Cuenta de Mercado Pago conectada.</p>
            <p className="text-xs text-gray-500 m-0">Falta vincular este local a una caja de esa cuenta.</p>
            <button onClick={vincular} disabled={vinculando}
              className="w-full p-2.5 bg-blue-500 text-white border-none rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
              {vinculando ? 'Vinculando…' : 'Vincular este local'}
            </button>
          </div>
        )}

        {conectado && mapeo && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm text-green-700 m-0">✓ Este local está vinculado a Mercado Pago.</p>
            <p className="text-xs text-gray-400 m-0">Los cobros de QR y Point van a llegar a "Por confirmar".</p>
          </div>
        )}
      </div>

      {conectado && <PendientesMpSinAsignar ownerId={ownerId} locales={locales} />}
    </div>
  )
}

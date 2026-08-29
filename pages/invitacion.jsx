import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { verInvitacion, aceptarInvitacion } from '../lib/services/miembros'
import { getSession } from '../lib/services/auth'
import { useUserRole } from '../lib/UserRoleContext'
import { LABEL_ROL } from '../lib/constants/roles'
import LoadingScreen from '../components/ui/LoadingScreen'
import AvisoAbrirEnChrome from '../components/layout/AvisoAbrirEnChrome'

/**
 * Pantalla que abre quien recibe el link de invitación.
 * Si no tiene sesión, lo mandamos a registrarse y volvemos acá con el token.
 */
export default function Invitacion() {
  const router = useRouter()
  const { token } = router.query
  const { cambiarLocal } = useUserRole()

  const [invitacion, setInvitacion] = useState(null)
  const [autenticado, setAutenticado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [aceptando, setAceptando] = useState(false)

  useEffect(() => {
    if (!token) return
    Promise.all([verInvitacion(token), getSession()])
      .then(([inv, session]) => {
        setInvitacion(inv)
        setAutenticado(!!session?.user)
      })
      .catch(() => setInvitacion(null))
      .finally(() => setCargando(false))
  }, [token])

  if (!token && router.isReady) return <Mensaje icono="🔗" titulo="Link incompleto" texto="Pedile a quien te invitó que te lo mande de nuevo." />
  if (cargando || !router.isReady) return <LoadingScreen mensaje="Verificando invitación…" icono="✉️" />

  if (!invitacion) return <Mensaje icono="❌" titulo="Invitación no encontrada" texto="El link no es válido o ya fue eliminado." />
  if (invitacion.estado === 'aceptada') return <Mensaje icono="✅" titulo="Esta invitación ya fue usada" texto="Si ya tenés cuenta, iniciá sesión para entrar al local." accion={{ label: 'Ir a iniciar sesión', onClick: () => router.push('/') }} />
  if (invitacion.estado === 'rechazada') return <Mensaje icono="🚫" titulo="Invitación cancelada" texto="Quien te invitó dio de baja este link." />
  if (invitacion.expirada || invitacion.estado === 'expirada') return <Mensaje icono="⏰" titulo="La invitación venció" texto="Los links duran 7 días. Pedile uno nuevo a quien te invitó." />

  const aceptar = async () => {
    setAceptando(true)
    try {
      const r = await aceptarInvitacion(token)
      if (!r?.ok) { toast.error(r?.error || 'No se pudo aceptar la invitación'); return }
      await cambiarLocal(r.local_id)
      toast.success(`Ya sos parte de ${invitacion.local_nombre}`)
      router.replace('/dashboard')
    } catch (err) {
      toast.error(`No se pudo aceptar: ${err.message}`)
    } finally { setAceptando(false) }
  }

  const irARegistro = () => router.push(`/registro?invitacion=${token}&email=${encodeURIComponent(invitacion.email_invitado || '')}`)

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 max-w-md w-full p-6 text-center">
        <div className="text-5xl mb-3">🏪</div>
        <h1 className="text-xl font-bold text-gray-900 m-0">Te invitaron a {invitacion.local_nombre}</h1>
        <p className="text-sm text-gray-600 mt-2 m-0">
          {invitacion.nombre_invitado ? `${invitacion.nombre_invitado}, vas ` : 'Vas '}
          a entrar como <strong>{LABEL_ROL[invitacion.rol] || invitacion.rol}</strong>.
        </p>

        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-left text-xs text-gray-600">
          {invitacion.rol === 'cajero'
            ? 'Como cajero vas a poder abrir y cerrar la caja, y registrar cobros y gastos.'
            : 'Como empleado vas a poder cargar los cobros de tus ventas. Abrir/cerrar caja y los gastos los maneja el dueño o un cajero.'}
        </div>

        <div className="mt-4 text-left">
          <AvisoAbrirEnChrome />
        </div>

        {autenticado ? (
          <button onClick={aceptar} disabled={aceptando}
            className="mt-5 w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600 disabled:opacity-50">
            {aceptando ? 'Entrando…' : 'Aceptar invitación'}
          </button>
        ) : (
          <>
            <button onClick={irARegistro}
              className="mt-5 w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">
              Crear mi cuenta
            </button>
            <button onClick={() => router.push(`/?invitacion=${token}`)}
              className="mt-2 w-full p-3 bg-gray-100 text-gray-700 border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-200">
              Ya tengo cuenta, iniciar sesión
            </button>
            <p className="text-xs text-gray-400 mt-3 m-0">
              Usá el mismo email al que te llegó la invitación: {invitacion.email_invitado}
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function Mensaje({ icono, titulo, texto, accion }) {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 max-w-md w-full p-6 text-center">
        <div className="text-5xl mb-3">{icono}</div>
        <h1 className="text-lg font-bold text-gray-900 m-0">{titulo}</h1>
        <p className="text-sm text-gray-600 mt-2 m-0">{texto}</p>
        {accion && (
          <button onClick={accion.onClick}
            className="mt-5 w-full p-3 bg-blue-500 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-600">
            {accion.label}
          </button>
        )}
      </div>
    </main>
  )
}

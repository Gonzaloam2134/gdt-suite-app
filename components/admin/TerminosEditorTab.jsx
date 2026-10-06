import { useState } from 'react'
import toast from 'react-hot-toast'
import { guardarConfigGlobal } from '../../lib/services/superadmin'
import { TERMINOS_TEXTO_DEFAULT, VERSION_TERMINOS_DEFAULT } from '../../lib/constants/legal'
import { hoyISO } from '../../lib/dates'
import TerminosContenido from '../legal/TerminosContenido'
import ConfirmDialog from '../ui/ConfirmDialog'
import Icono from '../ui/Icono'

/**
 * Pestaña "Términos" del panel de super admin: edita el texto vigente de los
 * Términos y Condiciones (`configuracion_global.terminos_texto`), que es lo
 * que ven todos los usuarios en /terminos y lo que tienen que volver a
 * aceptar si cambió (useTerminosGuard, vía lib/domain/terminos.js).
 *
 * Guardar SIEMPRE pisa `terminos_version` con la fecha de hoy (hora local
 * Argentina — lib/dates.js, nunca toISOString()) — es justamente el
 * mecanismo que hace que todo el mundo, incluidos los que ya habían
 * aceptado la versión anterior, tenga que aceptar de nuevo. Por eso pide
 * confirmación: no es un simple "guardar borrador".
 */
export default function TerminosEditorTab({ config, onGuardado }) {
  const vigente = config.terminos_texto || TERMINOS_TEXTO_DEFAULT
  const versionVigente = config.terminos_version || VERSION_TERMINOS_DEFAULT

  const [borrador, setBorrador] = useState(vigente)
  const [vistaPrevia, setVistaPrevia] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const hayCambios = borrador.trim() !== vigente.trim()

  const confirmarGuardado = async () => {
    setGuardando(true)
    try {
      const nuevaVersion = hoyISO()
      await guardarConfigGlobal({ terminos_texto: borrador, terminos_version: nuevaVersion })
      toast.success('✅ Términos actualizados — se le va a pedir la aceptación a todo el mundo')
      setConfirmando(false)
      await onGuardado()
    } catch (err) {
      toast.error(err.message || 'No se pudieron guardar los Términos')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-500/30 rounded-lg p-4">
        <p className="text-sm text-primary-700 m-0">
          <Icono nombre="candado" size={16} className="inline-block align-text-bottom mr-1.5 " />
          Editá acá el texto vigente de los Términos y Condiciones. Al guardar, se le pide la
          aceptación de nuevo a TODOS los usuarios (incluidos los que ya habían aceptado antes),
          sin necesitar un deploy.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-base font-bold text-gray-900 m-0">Texto vigente</h3>
          <span className="text-xs text-gray-500">Versión actual: <strong>{versionVigente}</strong></span>
        </div>

        <p className="text-xs text-gray-500 m-0">
          Formato markdown simple: <code># título</code>, <code>## sección</code>,{' '}
          <code>**negrita**</code>, <code>*cursiva*</code> y líneas que empiezan con{' '}
          <code>- </code> para listas.
        </p>

        <div className="flex gap-2">
          <button type="button" onClick={() => setVistaPrevia(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none ${!vistaPrevia ? 'press bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Editar
          </button>
          <button type="button" onClick={() => setVistaPrevia(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none ${vistaPrevia ? 'press bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Vista previa
          </button>
        </div>

        {vistaPrevia ? (
          <div className="border border-gray-200 rounded-lg p-4 max-h-[32rem] overflow-y-auto">
            <TerminosContenido texto={borrador} />
          </div>
        ) : (
          <textarea
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            rows={20}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-600 outline-none resize-vertical"
          />
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={!hayCambios || guardando}
            className="px-6 py-3 press bg-primary-600 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Guardar y pedir nueva aceptación
          </button>
          {hayCambios && (
            <button type="button" onClick={() => setBorrador(vigente)}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md text-xs font-semibold cursor-pointer hover:bg-gray-200">
              Descartar cambios
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={confirmarGuardado}
        danger
        loading={guardando}
        title="Actualizar Términos y Condiciones"
        message={`Esto cambia la versión vigente a "${hoyISO()}". Todos los usuarios —incluidos los que ya habían aceptado la versión anterior— van a tener que aceptarla de nuevo antes de seguir usando la app. ¿Confirmás?`}
        confirmLabel={guardando ? 'Guardando…' : 'Sí, actualizar'}
      />
    </div>
  )
}

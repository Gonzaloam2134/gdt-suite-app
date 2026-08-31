import { estadoEfectivo } from '../../lib/domain/suscripciones'
import { LABEL_SEGMENTO, LABEL_CICLO, DESCRIPCION_SEGMENTO } from '../../lib/constants/planes'
import { formatFecha } from '../../lib/format'

const ESTILO_ESTADO = {
  active:     { texto: 'Activo',      color: 'bg-green-100 text-green-800 border-green-200' },
  restricted: { texto: 'Restringido', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  suspended:  { texto: 'Suspendido',  color: 'bg-red-100 text-red-800 border-red-200' },
  cancelled:  { texto: 'Cancelado',   color: 'bg-gray-100 text-gray-700 border-gray-200' },
}

/**
 * Estado de la suscripción del local, visible solo para el dueño. Mientras
 * no esté conectado Mercado Pago, "Ver planes" es el único paso posible —
 * el botón de pago en /planes todavía dice "Próximamente".
 */
export default function SuscripcionTab({ suscripcion }) {
  const { estado, vencioPrueba, diasRestantes } = estadoEfectivo(suscripcion)
  const esPrueba = suscripcion?.plan === 'trial'
  const esPago = suscripcion?.plan === 'pago'
  const estilo = ESTILO_ESTADO[estado] || ESTILO_ESTADO.active

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-base font-bold text-gray-900 m-0">
            {esPago ? `Plan ${LABEL_SEGMENTO[suscripcion.segmento] || suscripcion.segmento}` : 'Prueba gratuita'}
          </h2>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${estilo.color}`}>
            {estilo.texto}
          </span>
        </div>

        {esPrueba && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 m-0">
              {vencioPrueba
                ? 'Tu prueba de 30 días terminó.'
                : diasRestantes !== null
                  ? `Te quedan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} de prueba gratuita.`
                  : 'Estás en la prueba gratuita de 30 días.'}
            </p>
            <p className="text-xs text-gray-400 m-0">
              Durante la prueba tenés acceso a todo, sin límites de equipo ni de locales.
            </p>
          </div>
        )}

        {esPago && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 m-0">{DESCRIPCION_SEGMENTO[suscripcion.segmento]}</p>
            <div className="grid grid-cols-2 gap-3 text-xs pt-2">
              <div>
                <div className="text-gray-400">Ciclo</div>
                <div className="font-semibold text-gray-800">{LABEL_CICLO[suscripcion.ciclo] || '—'}</div>
              </div>
              <div>
                <div className="text-gray-400">Próximo vencimiento</div>
                <div className="font-semibold text-gray-800">
                  {suscripcion.fecha_vencimiento ? formatFecha(suscripcion.fecha_vencimiento) : '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        {estado === 'restricted' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-900 m-0 font-semibold">Acceso restringido a solo Reportes</p>
            <p className="text-xs text-amber-800 mt-1 m-0">
              {vencioPrueba
                ? 'Tu prueba terminó. Elegí un plan para volver a operar la caja.'
                : 'Regularizá tu situación para volver a operar la caja.'}
              {' '}Mientras tanto, tus reportes siguen siempre disponibles.
            </p>
          </div>
        )}

        <a href="/planes"
          className="mt-4 block w-full text-center p-2.5 bg-blue-500 text-white border-none rounded-lg text-sm font-bold hover:bg-blue-600">
          {esPago ? 'Cambiar de plan' : 'Ver planes'}
        </a>
      </div>
    </div>
  )
}

import { useState } from 'react'

export default function ReportGuide({ isOpen, onClose }) {
  const [seccionAbierta, setSeccionAbierta] = useState('intro')

  if (!isOpen) return null

  const toggleSeccion = (id) => {
    setSeccionAbierta(seccionAbierta === id ? null : id)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-800 p-5 text-white flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">📖 Cómo leer tu reporte</h2>
            <p className="text-sm text-slate-300 mt-1">Guía simple para entender cada número, sin importar tu régimen fiscal.</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-300 hover:text-white text-2xl cursor-pointer bg-none border-none"
          >
            ✕
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          
          {/* SECCIÓN 1: INTRO */}
          <Seccion
            id="intro"
            titulo=" ¿Qué es este reporte?"
            estaAbierta={seccionAbierta === 'intro'}
            onClick={toggleSeccion}
          >
            <p className="text-sm text-gray-700 mb-3">
              Este reporte separa <strong>3 cosas que normalmente ves mezcladas</strong> cuando cerrás el día:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-2xl mb-1">💰</div>
                <div className="font-bold text-green-900 text-sm">Lo que es tuyo</div>
                <div className="text-xs text-green-700">Tu ganancia real</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-2xl mb-1">🏛️</div>
                <div className="font-bold text-blue-900 text-sm">Lo que es del Estado</div>
                <div className="text-xs text-blue-700">El IVA (si aplica)</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-2xl mb-1">💳</div>
                <div className="font-bold text-red-900 text-sm">Lo que te sacan</div>
                <div className="text-xs text-red-700">Comisiones de tarjetas</div>
              </div>
            </div>
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
              <p className="text-sm text-amber-900">
                <strong>💡 Analogía simple:</strong> Es como si vaciaras la caja registradora al final del mes, pero en lugar de contar todo junto, te mostramos de dónde viene cada peso.
              </p>
            </div>
          </Seccion>

          {/* SECCIÓN 2: RÉGIMEN FISCAL */}
          <Seccion
            id="regimen"
            titulo="🧾 ¿Cómo me afecta mi régimen fiscal?"
            estaAbierta={seccionAbierta === 'regimen'}
            onClick={toggleSeccion}
          >
            <p className="text-sm text-gray-700 mb-3">
              Este reporte funciona para todos, pero los números se interpretan distinto según tu situación. Identificáte:
            </p>
            
            <div className="space-y-3">
              <div className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50">
                <div className="font-bold text-blue-900 text-sm mb-1">🟦 Monotributista</div>
                <p className="text-xs text-blue-800 mb-2">
                  Pagás una cuota fija mensual que ya incluye todo (IVA + ganancias). No discriminás IVA en tus facturas.
                </p>
                <div className="text-xs text-blue-700 space-y-1">
                  <div>✅ <strong>Ignorá</strong> las filas de IVA (Débito/Crédito Fiscal).</div>
                  <div>✅ <strong>Mirá</strong> el "Ingreso Neto Real" y el "Resultado del Ejercicio".</div>
                  <div>✅ El "Neto Gravado" = "Total Facturado" (son lo mismo para vos).</div>
                </div>
              </div>

              <div className="border-2 border-purple-200 rounded-lg p-3 bg-purple-50">
                <div className="font-bold text-purple-900 text-sm mb-1">🟪 Responsable Inscripto</div>
                <p className="text-xs text-purple-800 mb-2">
                  Discriminás IVA en cada venta (generalmente 21%). Tenés que pagarle a AFIP la diferencia entre el IVA que cobraste y el que pagaste.
                </p>
                <div className="text-xs text-purple-700 space-y-1">
                  <div>✅ <strong>Mirá todo</strong>, especialmente el "IVA a pagar" (al pie del resumen).</div>
                  <div>✅ El "Neto Gravado" es tu venta real (sin IVA).</div>
                  <div>✅ El "Resultado del Ejercicio" ya descuenta el IVA que debés.</div>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="font-bold text-gray-900 text-sm mb-1">⬜ Exento u otro régimen</div>
                <p className="text-xs text-gray-800 mb-2">
                  No cobrás IVA por tu actividad. El reporte funciona igual, pero las filas de IVA serán $0.
                </p>
                <div className="text-xs text-gray-700">
                  ✅ <strong>Mirá</strong> lo mismo que el Monotributista.
                </div>
              </div>
            </div>
          </Seccion>

          {/* SECCIÓN 3: RESUMEN EJECUTIVO */}
          <Seccion
            id="resumen"
            titulo="📋 El Resumen Ejecutivo (línea por línea)"
            estaAbierta={seccionAbierta === 'resumen'}
            onClick={toggleSeccion}
          >
            <div className="space-y-3">
              <LineaExplicativa
                numero="1"
                titulo="Total Facturado (bruto)"
                color="gray"
                descripcion="La suma de TODO lo que tus clientes pagaron. Cada ticket, cada venta, todo junto."
                ejemplo="$17.136.935"
                advertencia="⚠️ Este número NO es tuyo (todavía). Parece mucho, pero esperá..."
              />
              <LineaExplicativa
                numero="2"
                titulo="(-) IVA Débito Fiscal"
                color="red"
                descripcion="De esos millones, esta parte NO es tuya, es del Estado (AFIP). Vos solo sos un 'recolector' del IVA: lo cobrás del cliente y después se lo entregás."
                ejemplo="-$2.974.178"
                notaRegimen="🟦 Monotributista: Esta fila será $0 o muy chica. No te afecta. | 🟪 Responsable Inscripto: Es el IVA que cobraste y tenés que pagarle a AFIP (menos el que pagaste en compras)."
              />
              <LineaExplicativa
                numero="3"
                titulo="Neto Gravado"
                color="gray"
                descripcion="Es el Bruto MENOS el IVA. O sea, lo que realmente facturaste por tus productos/servicios, sin la parte del Estado."
                ejemplo="$17.136.935"
                notaRegimen="🟦 Monotributista: Este número es igual al Bruto (porque no separás IVA). | 🟪 Responsable Inscripto: Este es tu 'venta real'."
              />
              <LineaExplicativa
                numero="4"
                titulo="(-) Comisiones de medios de pago"
                color="red"
                descripcion="Lo que te cobraron Visa, Mastercard, Mercado Pago, etc. por procesar tus ventas."
                ejemplo="-$202.695"
                advertencia="🔴 CLAVE: Son pesos que NUNCA van a entrar a tu bolsillo. Son el 'costo de aceptar tarjetas'."
                notaRegimen="Aplica igual para todos los regímenes. Es un costo real de tu negocio."
              />
              <LineaExplicativa
                numero="5"
                titulo="INGRESO NETO REAL"
                color="green"
                descripcion="Lo que EFECTIVAMENTE te entra después de sacar el IVA y las comisiones."
                ejemplo="$16.934.239"
                destacada="🎯 ESTE ES TU NÚMERO REAL"
                notaRegimen="Para todos: es la plata que realmente va a entrar a tu cuenta bancaria."
              />
              <LineaExplicativa
                numero="6"
                titulo="(-) Gastos operativos"
                color="red"
                descripcion="Todo lo que pagaste en el mes: proveedores, luz, gas, sueldos, alquiler, etc."
                ejemplo="-$1.315.960"
                notaRegimen="Aplica igual para todos. Son tus egresos reales."
              />
              <LineaExplicativa
                numero="7"
                titulo="(-) IVA Crédito Fiscal (compras)"
                color="gray"
                descripcion="El IVA que vos pagaste cuando compraste cosas para el negocio. Lo podés descontar del IVA que cobraste."
                ejemplo="-$228.389"
                notaRegimen=" Monotributista: Esta fila será $0. No podés deducir IVA. | 🟪 Responsable Inscripto: Es el IVA que pagaste en tus compras y lo restás del que cobraste."
              />
              <LineaExplicativa
                numero="8"
                titulo="RESULTADO DEL EJERCICIO"
                color="green"
                descripcion="Tu GANANCIA REAL del mes. Después de pagarle al Estado, a las tarjetas y todos tus gastos."
                ejemplo="$15.618.279"
                destacada="🏆 ESTE ES EL NÚMERO QUE IMPORTA"
                notaRegimen="Para todos: es lo que realmente te queda. Si es positivo, ganaste. Si es negativo, perdiste."
              />
            </div>

            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs font-bold text-slate-700 mb-2">🧮 Las 3 cajitas del fondo:</div>
              <div className="space-y-2 text-xs text-slate-700">
                <div><strong>Ventas (730):</strong> Cantidad de ventas que hiciste en el período.</div>
                <div><strong>Gastos (175):</strong> Cantidad de pagos/egresos que registraste.</div>
                <div><strong>IVA a pagar ($2.745.789):</strong> 🟪 Solo para Responsable Inscripto. Es la diferencia entre el IVA que cobraste y el que pagaste. <strong>🟦 Monotributista: ignorá este número</strong>, tu IVA ya está en la cuota mensual.</div>
              </div>
            </div>
          </Seccion>

          {/* SECCIÓN 4: TABLA DE VENTAS */}
          <Seccion
            id="tabla"
            titulo="📒 Cómo leer la tabla de ventas"
            estaAbierta={seccionAbierta === 'tabla'}
            onClick={toggleSeccion}
          >
            <p className="text-sm text-gray-700 mb-3">
              Cada fila es una venta individual. Vamos con un ejemplo real:
            </p>
            
            <div className="bg-white border-2 border-slate-300 rounded-lg overflow-hidden mb-3">
              <div className="bg-slate-100 p-2 text-xs font-bold text-slate-700">
                Ejemplo: Venta con Tarjeta de Crédito de $29.912
              </div>
              <div className="p-3 space-y-2">
                <FilaEjemplo columna="Bruto" valor="$29.912" significado="Lo que pagó el cliente" />
                <FilaEjemplo columna="Com. %" valor="3,5%" significado="Visa te cobra el 3,5%" highlight />
                <FilaEjemplo columna="Comisión" valor="$1.046" significado="Esa plata se la queda Visa, nunca la ves" highlight />
                <FilaEjemplo columna="Acreditación" valor="31/08/26" significado="La plata no te entra hasta 30 días después" highlight />
              </div>
            </div>

            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded mb-3">
              <p className="text-sm text-red-900">
                <strong>️ La lección más importante:</strong><br />
                Cuando un cliente te paga $10.000 con tarjeta de crédito al 3,5% a 30 días, vos <strong>NO recibís $10.000</strong>. Recibís $9.650... dentro de 30 días.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-xs font-bold text-slate-700 mb-2">📊 Qué significa cada columna:</div>
              <div className="space-y-1 text-xs text-slate-700">
                <div><strong>Fecha:</strong> El día que hiciste la venta.</div>
                <div><strong>Concepto:</strong> Qué vendiste (ej: "Venta de mostrador").</div>
                <div><strong>Medio:</strong> Cómo te pagó el cliente (nombre completo del medio).</div>
                <div><strong>Tipo:</strong> Clasificación (Efectivo, Débito, Crédito, Transferencia, QR).</div>
                <div><strong>Operador:</strong> La marca (Visa, Mastercard, Mercado Pago, Galicia, etc.).</div>
                <div><strong>Com. %:</strong> El porcentaje que te cobra ese medio (0% para efectivo).</div>
                <div><strong>Bruto:</strong> Lo que pagó el cliente.</div>
                <div><strong>Neto:</strong> Lo que es tuyo (sin IVA si sos RI).</div>
                <div><strong>IVA:</strong> La parte del Estado (si aplica).</div>
                <div><strong>Comisión:</strong> Lo que te saca el medio de pago.</div>
                <div><strong>Acreditación:</strong>  El día que te entra la plata al banco.</div>
                <div><strong>Neto Real:</strong> Lo que realmente te queda (Neto - Comisión).</div>
              </div>
            </div>
          </Seccion>

          {/* SECCIÓN 5: CALENDARIO */}
          <Seccion
            id="calendario"
            titulo="📅 El Calendario de Acreditaciones"
            estaAbierta={seccionAbierta === 'calendario'}
            onClick={toggleSeccion}
          >
            <p className="text-sm text-gray-700 mb-3">
              Esta tabla te muestra <strong>cuándo te entra cada peso al banco</strong>. Es clave para saber si tenés plata para pagar gastos.
            </p>

            <div className="space-y-2 mb-3">
              <div className="flex items-start gap-2 p-2 bg-green-50 rounded border border-green-200">
                <span className="text-lg">✅</span>
                <div>
                  <div className="text-xs font-bold text-green-900">Acreditado</div>
                  <div className="text-xs text-green-700">La plata ya entró a tu cuenta. Es de días anteriores.</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                <span className="text-lg">📍</span>
                <div>
                  <div className="text-xs font-bold text-blue-900">Hoy</div>
                  <div className="text-xs text-blue-700">La plata entra hoy. Contala como disponible.</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                <span className="text-lg">⏳</span>
                <div>
                  <div className="text-xs font-bold text-amber-900">Pendiente</div>
                  <div className="text-xs text-amber-700">La plata todavía no entró. No la cuentes como disponible.</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs font-bold text-slate-700 mb-2">⏱️ Plazos típicos de acreditación:</div>
              <div className="space-y-1 text-xs text-slate-700">
                <div>💵 <strong>Efectivo:</strong> Inmediato (mismo día).</div>
                <div>🏦 <strong>Transferencia:</strong> 0-1 día hábil.</div>
                <div>💳 <strong>Débito:</strong> 1-2 días hábiles.</div>
                <div>📱 <strong>QR (Mercado Pago, etc.):</strong> 1-2 días hábiles.</div>
                <div>💳 <strong>Crédito:</strong> 30-45 días (¡ojo con esto!).</div>
              </div>
            </div>
          </Seccion>

          {/* SECCIÓN 6: QUÉ MIRAR */}
          <Seccion
            id="que-mirar"
            titulo="🎯 ¿Qué miro según lo que necesito saber?"
            estaAbierta={seccionAbierta === 'que-mirar'}
            onClick={toggleSeccion}
          >
            <div className="space-y-3">
              <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
                <div className="font-bold text-green-900 text-sm mb-1">💰 "¿Cuánto gané este mes?"</div>
                <div className="text-xs text-green-800">
                  Mirá el <strong>RESULTADO DEL EJERCICIO</strong> (la última línea del resumen). Ese es tu número.
                </div>
              </div>
              <div className="border-l-4 border-blue-500 bg-blue-50 p-3 rounded">
                <div className="font-bold text-blue-900 text-sm mb-1">🏦 "¿Tengo plata para pagar gastos mañana?"</div>
                <div className="text-xs text-blue-800">
                  Mirá el <strong>Calendario de Acreditaciones</strong> → fila "Hoy" y "Acreditado". Eso es lo que tenés disponible.
                </div>
              </div>
              <div className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
                <div className="font-bold text-red-900 text-sm mb-1">💳 "¿Cuánto me están comiendo las tarjetas?"</div>
                <div className="text-xs text-red-800">
                  Mirá <strong>Comisiones de medios de pago</strong> en el resumen, y el <strong>Desglose por Medio de Pago</strong> para ver cuál te sale más caro.
                </div>
              </div>
              <div className="border-l-4 border-purple-500 bg-purple-50 p-3 rounded">
                <div className="font-bold text-purple-900 text-sm mb-1">🧾 "¿Cuánto le debo a AFIP?" (solo RI)</div>
                <div className="text-xs text-purple-800">
                  Mirá <strong>IVA a pagar</strong> (la cajita al pie del resumen). Si sos Monotributista, ignorá esto.
                </div>
              </div>
            </div>
          </Seccion>

          {/* SECCIÓN 7: CONSEJOS */}
          <Seccion
            id="consejos"
            titulo="💡 Consejos prácticos"
            estaAbierta={seccionAbierta === 'consejos'}
            onClick={toggleSeccion}
          >
            <div className="space-y-3 text-sm text-gray-700">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <strong className="text-amber-900">1. El efectivo es rey 👑</strong>
                <p className="text-xs text-amber-800 mt-1">0% comisión, acreditación inmediata. Cada venta en efectivo es plata limpia en tu bolsillo hoy.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <strong className="text-amber-900">2. Cuidado con el crédito a 30-45 días ⏳</strong>
                <p className="text-xs text-amber-800 mt-1">Vendés hoy, cobrás en un mes. Si tenés que pagar proveedores esta semana, no cuentes esa plata como disponible.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <strong className="text-amber-900">3. Compará comisiones entre medios 💳</strong>
                <p className="text-xs text-amber-800 mt-1">En el "Desglose por Medio de Pago" ves cuál te cuesta más. A veces conviene ofrecer descuento por efectivo o transferencia.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <strong className="text-amber-900">4. Usá el filtro de período 📅</strong>
                <p className="text-xs text-amber-800 mt-1">Podés ver "Este mes", "Mes anterior", "Últimos 30 días" o un rango personalizado. Ideal para comparar meses.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <strong className="text-amber-900">5. Exportá a Excel para tu contador 📊</strong>
                <p className="text-xs text-amber-800 mt-1">El botón "Exportar Excel" te genera un archivo con 5 hojas listas para entregarle a tu contador.</p>
              </div>
            </div>
          </Seccion>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-slate-700"
          >
            Entendido, cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// Componente auxiliar: Sección colapsable
function Seccion({ id, titulo, estaAbierta, onClick, children }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => onClick(id)}
        className={`w-full p-3 text-left flex justify-between items-center cursor-pointer border-none transition-colors ${
          estaAbierta ? 'bg-slate-100' : 'bg-white hover:bg-gray-50'
        }`}
      >
        <span className="font-bold text-sm text-gray-900">{titulo}</span>
        <span className="text-gray-400 text-lg">{estaAbierta ? '▼' : '▶'}</span>
      </button>
      {estaAbierta && (
        <div className="p-4 bg-white border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  )
}

// Componente auxiliar: Línea explicativa del resumen
function LineaExplicativa({ numero, titulo, descripcion, ejemplo, color, advertencia, destacada, notaRegimen }) {
  const colorClasses = {
    green: 'border-green-300 bg-green-50',
    red: 'border-red-300 bg-red-50',
    gray: 'border-gray-300 bg-gray-50'
  }
  const textColors = {
    green: 'text-green-900',
    red: 'text-red-900',
    gray: 'text-gray-900'
  }

  return (
    <div className={`border-l-4 ${colorClasses[color]} rounded-r-lg p-3`}>
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
          color === 'green' ? 'bg-green-600' : color === 'red' ? 'bg-red-600' : 'bg-gray-600'
        }`}>
          {numero}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start mb-1 flex-wrap gap-2">
            <div className={`font-bold text-sm ${textColors[color]}`}>{titulo}</div>
            {ejemplo && <div className="font-extrabold text-sm text-gray-900">{ejemplo}</div>}
          </div>
          <p className="text-xs text-gray-700 mb-2">{descripcion}</p>
          {destacada && (
            <div className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded inline-block mb-2">
              {destacada}
            </div>
          )}
          {advertencia && (
            <div className="text-xs text-amber-800 bg-amber-100 px-2 py-1 rounded mb-2">
              {advertencia}
            </div>
          )}
          {notaRegimen && (
            <div className="text-xs text-blue-800 bg-blue-100 px-2 py-1 rounded mt-2">
              <strong>📌 Según tu régimen:</strong> {notaRegimen}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Componente auxiliar: Fila de ejemplo en tabla
function FilaEjemplo({ columna, valor, significado, highlight }) {
  return (
    <div className={`flex items-start gap-2 p-2 rounded ${highlight ? 'bg-red-50 border border-red-200' : 'bg-slate-50'}`}>
      <div className="font-bold text-xs text-slate-700 w-24 flex-shrink-0">{columna}:</div>
      <div className="font-extrabold text-xs text-slate-900 w-20 flex-shrink-0">{valor}</div>
      <div className="text-xs text-slate-700 flex-1">{significado}</div>
    </div>
  )
}

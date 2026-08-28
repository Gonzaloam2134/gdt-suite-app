# Correcciones aplicadas tras la auditoría

Todo lo de abajo pasa `npm test` (49/49) y `npm run build`. No se tocó ningún dato
en producción ni se aplicó ninguna migración: no tuve acceso al proyecto Supabase
real de esta app desde este entorno (las únicas credenciales de Supabase
disponibles apuntaban a otros dos proyectos sin relación). Por eso todo lo que
requiere un `CHECK`, índice único o trigger en la base queda documentado como
pendiente al final, no aplicado.

## 1. Bug de cálculo en las cards de caja (el motivo original de este pase)

**Síntoma:** "Disponible hoy" y "Acreditaciones del día" mostraban de menos, o en
$0, aunque hubiera plata por acreditarse ese día.

**Causa real:** `calcularTotalesDia` (usada por el dashboard) solo procesa las
transacciones **creadas** ese día. Una venta con tarjeta de crédito de hace 2 días
que recién **acredita** hoy nunca entraba en esa cuenta — la función ni siquiera
tenía esos datos disponibles, porque `listarTransaccionesDia` los filtra por
`creado_en`, no por `fecha_acreditacion_estimada`.

**Arreglo:**
- `lib/services/transacciones.js`: nueva `listarAcreditacionesDia(localId, diaISO)`,
  que trae cobros por **fecha de acreditación**, sin importar cuándo se crearon.
- `lib/domain/transacciones.js`: nueva función pura `calcularAcreditacionesDia`,
  y `calcularTotalesDia` ya no calcula `disponibleHoy`/`acreditacionesHoy` (eso
  requeriría datos que esa función no tiene) — sí sigue calculando
  `pendienteAcreditacion` correctamente (ventas de hoy que acreditan después).
- `hooks/useTransaccionesDia.js`: pide ambas consultas en paralelo y combina los
  resultados. También se le agregó guarda de "componente desmontado" (ver punto 3).
- `tests/transacciones.test.js`: se agregó la suite `calcularAcreditacionesDia`,
  incluyendo el caso que reproduce el bug (venta de hace 2 días que acredita hoy).

## 2. `pages/superadmin.jsx` — reescrito

Era el hallazgo Crítico #2 de la auditoría: 935 líneas con Supabase directo,
sin capa de servicios, `confirm()` nativo, y dos bugs de lógica reales. Se
reescribió manteniendo el mismo diseño visual y las mismas 7 pestañas, pero:

- **Toda consulta/mutación pasa por `lib/services/*`** (regla del propio
  `REFACTOR.md`: "`supabase.from(...)` SOLO en `lib/services/*`"). Se agregaron:
  - `lib/services/superadmin.js`: `listarLocalesConMiembros()`.
  - `lib/services/suscripciones.js`: `listarSuscripcionesConOwner()`.
  - `lib/services/contactos.js`: `listarContactosConDetalle()`.
  - `hooks/useSuperAdminData.js`: hook de datos del panel, igual que
    `useAdminData` para `/admin`.
- **Bug real corregido — "Activar local" reactivaba gente que vos habías echado:**
  el handler viejo tocaba `miembros_locales.activo` de TODOS los miembros del
  local para "suspender/activar". Si un local suspendido tenía miembros que
  habían sido quitados por otro motivo (`quitarMiembro`), activarlo los
  reincorporaba a todos sin querer. Ahora usa `locales.activo` (el campo que ya
  existía para esto exacto, con el servicio `setLocalActivo`) y no toca
  membresías.
- **Bug real corregido — editar el email del usuario no cambiaba el login:**
  `perfiles.email` es solo un espejo para mostrar en la UI; el login real usa
  `auth.users.email` (Supabase Auth), que este panel nunca tocaba. Se sacó la
  edición de email del panel (queda solo el rol global) y se explica por qué
  en la propia pantalla.
- **Hallazgo nuevo, no estaba en la auditoría original — hack de creación de
  tabla desde el cliente:** `handleGuardarConfig` tenía un fallback que llamaba
  `supabase.rpc('create_configuracion_table')` si el `upsert` fallaba. Un
  cliente browser no debería poder disparar una creación de tabla; se eliminó
  por completo (la tabla ya existe según `REFACTOR.md`).
- **Hallazgo nuevo — dos valores de estado distintos para lo mismo:**
  `lib/services/contactos.js#responderContacto` guardaba `estado: 'respondido'`,
  pero toda la UI (filtros, contadores, badges) espera `'resuelto'`. Se corrigió
  el servicio para que use `'resuelto'`.
- **Hallazgo nuevo — joins con `!inner` escondían filas:** las consultas de
  locales y suscripciones usaban `miembros_locales!inner(...)`, así que un local
  sin miembros (alta que falló a mitad de camino) o una suscripción sin owner
  vigente directamente desaparecían de la lista en vez de mostrarse sin datos.
  Se sacó el `!inner` en ambas.
- `confirm()` nativo → `ConfirmDialog` (2 lugares: suspender local, cambiar
  estado de suscripción).
- Consultas antes sin límite (`usuarios`, `locales`, `suscripciones`) ahora
  tienen `.limit(200–500)` como tope defensivo. No es paginación real — eso
  queda como pendiente (ver abajo) — pero evita que la pantalla se vuelva
  arbitrariamente pesada a medida que crece la plataforma.
- Sesión y navegación: pasó a usar `useAuthGuard`, `useUserRole` (`esSuperUser`)
  y `useSignOut`, igual que el resto de la app, en vez de reimplementarlos.

`components/ContactModal.jsx` también usaba Supabase directo para insertar en
`contactos`; ahora usa `crearContacto` de `lib/services/contactos.js`.

## 3. Condiciones de carrera (`setState` después de `await`)

- `hooks/useTransaccionesDia.js` y `hooks/useCaja.js`: se agregó un ref
  `montado` que se chequea antes de cada `setState` posterior a un `await`,
  siguiendo el mismo patrón que ya usaban `useAuthGuard`/`useActiveLocal`.
- `hooks/useReportes.js`: se agregó una guarda de "petición vigente"
  (`peticionActual`, un contador con `useRef`) para que, si el usuario cambia
  de período muy rápido y las respuestas llegan fuera de orden, la respuesta
  vieja no pise el resultado del período que el usuario realmente eligió.
- `hooks/useReportes.js`: `locales.every(...)` sobre un array vacío daba
  `true` por vacuidad lógica (mostraba "Responsable Inscripto" con 0 locales);
  se agregó el guard `locales.length > 0 &&`.

## 4. Reversa duplicada y validación de montos

- `components/ReversaModal.jsx`: antes de insertar el asiento inverso, revalida
  el estado de la transacción (`getTransaccion`, nuevo en
  `lib/services/transacciones.js`). Si alguien más ya la anuló mientras el
  modal estaba abierto, avisa en vez de crear una segunda reversa. **Esto
  reduce la ventana de carrera, no la elimina** — la eliminación completa
  requiere un constraint/trigger en la base (ver "Pendiente" abajo).
- `hooks/useCaja.js#abrir`: misma idea — revalida `getCajaAbiertaHoy` justo
  antes de insertar, para reducir (no eliminar) la ventana en la que dos
  personas del mismo local abren caja a la vez.
- `components/MovimientoModal.jsx`: valida `Number.isFinite` (rechaza
  `NaN`/`Infinity`, notación científica) y agrega un tope de monto
  (`$99.999.999,99`) para no dejar pasar errores de tipeo evidentes.
- `hooks/useCaja.js#abrir/cerrar`: mismo saneo de `Number.isFinite` sobre el
  monto inicial y el efectivo contado al cerrar.
- `components/caja/AperturaCajaModal.jsx`: el `onKeyDown` de Enter ahora
  respeta `procesando`, así que Enter repetido mientras la primera apertura
  sigue en vuelo no dispara una segunda.

## 5. Mensajes de error

Nuevo `lib/errorMessage.js` con `mensajeError(err)`: traduce patrones comunes
de Postgres/Supabase (clave duplicada, referencia rota, sin red, sesión vencida)
a un mensaje legible; si no reconoce el patrón, deja el mensaje original en vez
de taparlo con un genérico. Aplicado en `MovimientoModal`, `ReversaModal` y
`useCaja` (los tres que la auditoría señaló mostrando `err.message` crudo).

---

## Pendiente — requiere acceso a la base de datos real (no disponible acá)

Estos ítems del ranking Crítico/Alto no se pueden cerrar del todo solo con
cambios de frontend:

1. **Apertura de caja duplicada entre dos usuarios del mismo local.** El
   arreglo de este pase (revalidar antes de insertar) reduce la ventana de
   milisegundos, pero la eliminación real requiere un **índice único parcial**
   en `cierres_caja` (`local_id`, fecha del día, `estado = 'abierta'`) o un
   trigger que la rechace en la base.
2. **Reversa duplicada entre dos usuarios.** Mismo caso: revalidar antes de
   insertar reduce el riesgo, pero un trigger que rechace un segundo `INSERT`
   de reversa sobre una transacción ya `revertida` es lo único que lo cierra
   del todo.
3. **Validación de montos en el servidor.** Se agregó saneo en el cliente,
   pero si no existe ya un `CHECK (monto > 0)` (o equivalente) en `transacciones`
   y `cierres_caja`, alguien pegándole directo a la API de Supabase con la
   anon key podría insertar montos inválidos. No pude confirmar si ese
   `CHECK` ya existe.
4. **Comisión/plazo de acreditación calculados a partir de datos que manda el
   cliente.** `registrarCobro` recibe el objeto `medio` completo del cliente y
   confía en su `comision_porcentaje`/`plazo_acreditacion_dias`. Si no hay un
   trigger que los recalcule server-side a partir de `medio_pago_id`, alguien
   con las devtools abiertas podría manipular su propia comisión reportada.
5. **Índices para consultas de período largo.** No pude confirmar si existe un
   índice compuesto `(local_id, creado_en)` en `transacciones`. Sin él,
   `listarTransaccionesPeriodo` (reportes de "trimestre", "últimos 30 días")
   va a degradar a medida que la tabla crezca.

## Pendiente — decisión de producto, no de código

- **Paginación real** en `/superadmin` (usuarios, locales, suscripciones,
  contactos): hoy tienen un `.limit()` defensivo, pero no hay paginación de
  verdad. Es una mejora de mayor alcance que no se justificaba meter en este
  pase sin poder probarla contra datos reales de volumen.
- **Manejo explícito de "sin conexión"** (`navigator.onLine`) en los hooks de
  caja: hoy cualquier error de red cae en el mismo mensaje genérico que un
  error de datos. Es una decisión de UX (qué mostrar, si reintentar solo o
  pedirle al usuario que reintente) que preferí no resolver sin poder probarla
  en un dispositivo real con conectividad intermitente.
- **Redondeo con floats** en sumas de período largo: riesgo teórico, no
  confirmado en producción. Migrar a una librería de precisión decimal
  (`decimal.js` o enteros en centavos) es un cambio transversal a todo
  `lib/domain/*` que no se justifica sin evidencia de que ya esté pasando.

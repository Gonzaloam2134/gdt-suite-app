# Auditoría — GDT Suite

> **Actualización post-auditoría:** la mayoría de los hallazgos de código (no los que
> requieren un cambio de schema/constraint en la base) fueron corregidos. Ver
> `CORRECCIONES.md` para el detalle de qué se arregló, cómo, y qué queda pendiente
> porque requiere acceso a la base de datos real de este proyecto (no disponible
> desde este entorno).


Alcance leído en detalle: `lib/domain/*`, `lib/services/*`, todos los `hooks/*`, `lib/UserRoleContext.jsx`, páginas principales (`dashboard`, `locales`, `admin`, `reportes`, `superadmin`, `invitacion`, `registro`), y los componentes de caja/admin/movimientos. No se ejecutó ni modificó código de la app. **`CLAUDE.md` está vacío**, así que no hay reglas de arquitectura escritas contra las cuales contrastar — el punto 4 lo evalúo contra el patrón que el propio código establece (lib/domain puro + lib/services + hooks), no contra un documento.

---

## 1. Bugs de lógica y edge cases

**🔴 Apertura de caja: condición de carrera entre dos usuarios del mismo local** — `hooks/useCaja.js:14-23` + `lib/services/cierresCaja.js:5-17`
`getCajaAbiertaHoy` se consulta al montar y `abrirCaja` inserta sin ninguna verificación atómica (ni upsert condicional, ni check de "ya existe una abierta" en el mismo statement). Si el owner y el cajero entran al dashboard casi al mismo tiempo y ambos ven `cajaAbierta: null`, los dos pueden abrir caja y quedar **dos cajas "abierta" simultáneas para el mismo local y mismo día**. Los cálculos de `efectivoEsperado` y el cierre posterior van a tomar una caja arbitraria (la que `getCajaAbiertaHoy` devuelva primero con `.maybeSingle()`), lo que puede hacer que el cierre reporte una diferencia de efectivo falsa. No vi el schema SQL, así que **no puedo confirmar si hay un índice único parcial** (`local_id, fecha, estado='abierta'`) en la base — si no lo hay, esto es un bug real y no solo un problema de UI; si lo hay, el fallo es solo de UX (ver punto 5).

**🟠 Reversa duplicada por carrera entre dos usuarios** — `components/ReversaModal.jsx:17-33` + `lib/services/transacciones.js:66-80`
`registrarReversa` inserta un asiento inverso sin comprobar el estado actual de `transaccion.revertida` (la comprobación vive del lado del trigger de DB, que marca la original — no impide un segundo insert). Si el owner y el cajero abren el mismo movimiento para cancelarlo (por ejemplo, ambos vieron la lista antes de que la primera reversa recargara), pueden generar **dos reversas para la misma transacción original**, duplicando el ajuste en caja y en los reportes. La UI no deshabilita el botón "Cancelar" mientras otro cliente ya la anuló, porque no hay revalidación server-side antes del insert, solo optimismo de que quien lo intenta ve datos frescos.

**🟡 `useCaja.abrir/cerrar` no cancelan `setState` tras `await`** — `hooks/useCaja.js:25-66`
A diferencia de `useActiveLocal`, `useTransaccionesDia`, `useAuthGuard` (que sí usan flag `cancelado`), `abrir` y `cerrar` llaman `setCajaAbierta`, `setProcesando` después de un `await` sin chequear si el componente sigue montado. Si el usuario cierra el modal (desmonta) mientras la petición de red sigue en vuelo, React tira warning de "state update on unmounted component" y, peor, si en el medio cambió de local, el callback igual pisa el estado del hook con datos del local anterior.

**🟡 Zonas horarias — cálculo de "hoy" bien resuelto en `lib/dates.js`, pero mal reusado en un lugar** — el comentario del propio archivo `dates.js:1-5` advierte contra `toISOString().split('T')[0]`. Confirmé que **ningún archivo de servicios o componentes rompe esa regla** — dato positivo, no bug, pero lo señalo porque la disciplina en este punto es correcta y vale la pena no aflojarla.

**🟡 `fechaAcreditacionDe` depende del reloj del navegador del cliente** — `lib/domain/transacciones.js:58-61` + `dates.js:37-41`
`sumarDias` opera con `new Date(fecha)`, que parte de un `Date` con hora real (no medianoche), y preserva la hora original al sumar días. No encontré un caso roto concreto de cálculo, pero **dejo la duda**: no verifiqué qué pasa si el navegador del usuario no está en UTC-3 (viaje, VPN, reloj del dispositivo mal configurado). Todo el sistema de "hoy" depende del reloj/zona del navegador del cliente, no del servidor. Un cajero con el celular mal configurado puede cargar movimientos que terminan clasificados en el día equivocado, y nada del lado servidor lo corrige.

**🟠 Validación de montos: solo en el cliente, y con huecos** — `components/MovimientoModal.jsx:63`, `AperturaCajaModal` (sin validación propia), `CierreCajaModal:16-17`
- `MovimientoModal` valida `montoNum <= 0`, bien. Pero no hay tope máximo ni chequeo de `Number.isFinite` — pegar `1e21` o un número con notación científica pasa el `parseFloat` y viaja tal cual a `registrarCobro`.
- `useCaja.abrir` sí valida `Number.isNaN(monto) || monto < 0` (`hooks/useCaja.js:27`), pero **`AperturaCajaModal` no valida nada antes de invocar `onConfirmar`**, así que si el usuario escribe letras, `parseFloat('abc')` es `NaN` y el mensaje de error es genérico, sin foco en el campo.
- Ninguna de estas validaciones existe en el servidor (los `services/*.js` no re-validan `monto > 0` antes de insertar). Confío en que haya un `CHECK` en la tabla `transacciones`/`cierres_caja` — no lo pude ver — pero si no lo hay, **cualquier request directo a la API de Supabase con la anon key podría insertar montos negativos o cero**, lo que rompe todos los totales de `calcularTotalesDia`.

**🟡 Redondeo con `Math.round(v*100)/100`** — `lib/domain/transacciones.js:10`
Es el patrón estándar y funciona para la inmensa mayoría de los casos, pero es sensible a errores de punto flotante en sumas encadenadas de muchos movimientos. Con volúmenes de un comercio real (decenas de movimientos/día) el error acumulado es despreciable, pero en un "Total Facturado" trimestral con miles de filas podría desviar centavos. Es una duda razonable más que un bug confirmado — no hay evidencia de que ya esté pasando, pero tampoco hay ningún mecanismo (decimal.js, enteros en centavos) que lo prevenga.

**🟡 `discriminaIva` para "todos los locales" con array vacío** — `hooks/useReportes.js:61-63`: `locales.every(...)` sobre un array vacío es `true` por vacuidad lógica, lo que haría que un usuario sin locales (caso borde improbable en este flujo) vea "Responsable Inscripto" por defecto en vez de un estado neutro.

**🟡 `handleSuspenderLocal` en superadmin reactiva a todo el mundo, no solo al local** — `pages/superadmin.jsx:213-231`
Este handler hace `update({ activo: nuevoEstado === 'activo' }).eq('local_id', localId)` sobre **toda** la tabla `miembros_locales` del local. Si "Activar local" se usa sobre un local que tenía miembros legítimamente dados de baja (vía `quitarMiembro`, que también pone `activo=false`), **el súper admin los reincorpora a todos sin querer** al reactivar el local. Mezcla "el local está suspendido" con "estos miembros están inactivos", que son conceptos distintos en el resto del código (`locales.activo` vs `miembros_locales.activo`, ver `lib/services/locales.js:20-21`, que sí los separa con el comentario "no toca miembros_locales").

---

## 2. Seguridad

**🔴 `pages/superadmin.jsx` no usa la capa `lib/services/*` y hace queries directas y anchas** — todo el archivo (935 líneas)
- `select('*')` sin filtros de columnas sobre `perfiles` (`:114-118`), `locales` con joins anidados `miembros_locales!inner(user_id, rol, perfiles(email, nombre))` (`:121-128`) y `suscripciones` con el mismo join anidado (`:131-138`). Esto trae a un cliente browser **el email y nombre de cada usuario de cada local de toda la plataforma** en una sola carga, sin paginar. Confío en que RLS limite esto a `rol_global = super_user` (la página lo chequea al montar, línea 53-58), pero aun así es una superficie de exposición grande: cualquier XSS o extensión maliciosa en la sesión de un super_user puede exfiltrar la base completa de usuarios de un solo llamado a la red.
- `handleActualizarUsuario` (`:194-211`) permite editar `perfiles.email` desde el cliente sin tocar `auth.users.email`. Esto **desincroniza el login (Supabase Auth) del email mostrado en la app**: un super admin cambia el email en la tabla `perfiles` pensando que así el usuario inicia sesión con el nuevo email, pero el login real sigue usando el email de `auth.users`. Es un bug de seguridad/confusión, no solo de UX.
- Duda: `actualizarUsuario` en `lib/services/superadmin.js:19-24` sí existe como función de servicio equivalente y correctamente comentada ("Solo super_user puede cambiar rol_global (trigger proteger_rol_global)"), pero **`superadmin.jsx` no la usa** — reimplementa el mismo `update` a mano sin pasar por esa capa. No pude confirmar si el trigger de DB protege igual el `update` directo a la tabla vía este código, pero como usa el mismo cliente supabase con las mismas políticas RLS, probablemente sí — el problema es de mantenibilidad/duplicación más que de bypass real.

**🟠 Comisión y fecha de acreditación confían en lo que el cliente manda como `medio`** — `lib/services/transacciones.js:34-49`, `MovimientoModal.jsx:53,67-68`
`registrarCobro` recibe el objeto `medio` completo desde el cliente (`comision_porcentaje`, `plazo_acreditacion_dias`) y lo usa directo para calcular `comision_monto` y `fecha_acreditacion_estimada`, que se **persisten** en la fila. En el flujo normal de la UI el valor viene de `listarMediosPago` y es confiable — pero nada impide que alguien con las devtools abiertas llame a `registrarCobro` pasando un `medio` fabricado a mano con `comision_porcentaje: 0`, evitando que se le cobre comisión en los libros aunque el medio real tenga comisión configurada. **Si no hay un trigger que recalcule `comision_monto` server-side a partir de `medio_pago_id`, un cajero deshonesto puede manipular sus propios reportes de comisión.** Lo marco como duda porque depende de una capa (RLS/triggers) que no pude inspeccionar.

**🟡 `ContactModal.jsx` y `superadmin.jsx` usan `supabase` directo en vez de `lib/services/contactos.js`** — `ContactModal.jsx:38`, `superadmin.jsx:175-183`
Ya existe `lib/services/contactos.js` con `crearContacto` y `responderContacto`, pero ambos componentes llaman a `supabase.from('contactos')` directamente, duplicando la lógica de inserción/actualización. No es una falla de seguridad por sí sola (mismo cliente, mismas políticas), pero aumenta el riesgo de que alguien cambie la validación en el servicio y se olvide de estos dos call-sites.

**🟡 Datos sensibles en el DOM sin necesidad** — `ContactModal.jsx:104` y `superadmin.jsx:106` muestran `localId.substring(0,8)` como "ID" visible al usuario — expone parcialmente un UUID interno en la UI sin aportar valor al usuario final.

**🟢 Lo que está bien:** el patrón `FAIL-CLOSED` de `UserRoleContext` (`role = null` si no se puede determinar) y `RoleGate` es sólido y consistente. `lib/services/*` en general sí filtra por `local_id`/`user_id` correctamente y separa `rol_global` de `rol` por local con comentarios explícitos de por qué (`miembros.js:28`, `EditarMiembroModal.jsx:6-9`) — se nota que hubo un bug pasado ahí y se corrigió con disciplina.

---

## 3. Performance

**🟠 `pages/superadmin.jsx` trae todo sin paginar, en cada carga de la pantalla** — `:65-159`
`listarUsuarios`, `todosLosLocales` (con join anidado de miembros y perfiles), `suscripciones` (ídem) y `contactos` se traen enteros con `select('*')`, sin `limit`, sin paginación ni filtro por fecha. Con una plataforma que crezca a cientos de locales y miles de usuarios, esta pantalla se vuelve progresivamente más lenta y transfiere cada vez más datos al navegador del super admin en cada visita.

**🟡 `resumenHoyPorLocal` y `contarTransacciones` sin índice visible confirmable** — `lib/services/transacciones.js:23-27,83-102`
Filtran por `local_id IN (...)` + rango de `creado_en`. Es razonable asumir que existe un índice compuesto `(local_id, creado_en)`, pero no pude verificar el schema. Si no existe, `listarTransaccionesPeriodo` sobre "últimos 30 días" o "trimestre" en `useReportes.js` va a hacer table scan a medida que la tabla crece.

**🟠 `useReportes.cargar` sin guarda anti-carrera entre cambios de período** — `hooks/useReportes.js:36-52`
A diferencia de `useResumenLocales` (que sí usa flag `cancelado`), esta función no tiene guarda contra respuestas fuera de orden. Si el usuario cambia de preset de período muy rápido (por ejemplo "este mes" → "trimestre") con conexión lenta, y la respuesta del período viejo llega después que la del nuevo, **el resultado del período viejo puede pisar al nuevo**, mostrando datos de un período distinto al seleccionado sin que haya ningún indicio visual de la inconsistencia.

**🟡 Sin memoización de componentes que renderizan listas grandes** — `ListaTransacciones.jsx:21-22` recalcula `items.filter(t => !t.anulada).length` en cada render sobre el array completo, no memoizado; con `usePaginacion` de por medio esto es barato hoy (listas de un día de un local), pero sería una regresión fácil de arrastrar si se reusa el componente para listas más largas.

**🟢 Buen patrón:** carga diferida de `jsPDF`/`ExcelJS` solo al exportar (`pages/reportes.js:37-39`), comentado explícitamente. `usePaginacion` es simple y en memoria, adecuado para el volumen esperado.

---

## 4. Arquitectura y clean code

**🔴 `pages/superadmin.jsx` es un outlier arquitectónico total frente al resto del código** (935 líneas)
Todo el resto de la aplicación separa consistentemente: `lib/domain` (puro, testeado), `lib/services` (I/O a Supabase), `hooks` (estado + orquestación), componentes (presentación). `superadmin.jsx` rompe las cuatro capas en un solo archivo: hace queries Supabase directas dentro del componente, mezcla 7 "tabs" completos (dashboard, contactos, usuarios, locales, suscripciones, config, anuncios) en un único `return`, usa `confirm()` nativo del navegador en vez de `ConfirmDialog` (que sí existe y se usa en todos lados: `MiembrosTab.jsx`, `MediosPagoTab.jsx`), y reimplementa `useAuthGuard`/`signOut` a mano (`:49-63,296`) en vez de reusar los hooks existentes. Ya existen `lib/services/superadmin.js`, `lib/services/suscripciones.js`, `lib/services/contactos.js`, `lib/services/anuncios.js` con funciones equivalentes a casi todo lo que esta página hace a mano — es código duplicado y con otro estilo, probablemente escrito en otro momento del proyecto sin refactorizar después.

**🟠 Componente monolítico** — el archivo completo de `superadmin.jsx` debería dividirse en al menos 7 componentes de tab (siguiendo el patrón ya usado en `components/admin/*Tab.jsx`), cada uno con su propio hook de datos (siguiendo el patrón `useAdminData`).

**🟡 Duplicación puntual de acceso a Supabase fuera de `lib/services`**: `ContactModal.jsx:38`, `superadmin.jsx` (todo). Ya señalado en seguridad, lo repito aquí porque es también una violación de la separación de capas que el resto del proyecto respeta.

**🟢 Lo que está muy bien:** `lib/domain/transacciones.js` y `lib/domain/reportes.js` son ejemplares — puros, comentados explicando el *por qué* de decisiones no obvias (p. ej. "el reporte anterior fabricaba tipo, punto de venta y número... y eso es lo que un contador termina cargando como si fuera real"), y con tests (`tests/reportes.test.js`, `tests/transacciones.test.js`). `useCaja`, `useTransaccionesDia`, `useAdminData` siguen el mismo patrón prolijo de: hook llama a `lib/services`, calcula con `lib/domain`, expone estado a la UI. `MovimientoModal` unificando cobro/gasto en un componente configurable (`CONFIG` object) es una buena abstracción, no prematura, porque efectivamente comparten el 90% del formulario.

---

## 5. UX y accesibilidad

**🟡 Estados de error poco accionables en algunos flujos** — `MovimientoModal.jsx:79-82`, `ReversaModal.jsx:30-32`: los mensajes de error muestran `err.message` crudo de Supabase directamente al usuario final ("No se pudo guardar: {err.message}"), lo cual puede filtrar detalle técnico (nombre de constraint, columna) en vez de un mensaje humano. Contraste con `MiembrosTab.jsx:56-58`, que sí traduce el error de duplicado a un mensaje claro — la inconsistencia es que unos flujos lo hacen y otros no.

**🟡 `confirm()` nativo en superadmin** (`:217,234`) es inconsistente con `ConfirmDialog` usado en el resto de la app, no se puede estilizar y puede comportarse de forma inconsistente entre navegadores/dispositivos, en particular en mobile.

**🟡 Sin manejo explícito de "sin conexión"** — no encontré en ningún hook (`useCaja`, `useTransaccionesDia`, `useAdminData`) un chequeo de `navigator.onLine` ni un mensaje diferenciado para "no hay red" vs "error del servidor". Todos los catch caen al mismo `toast.error` genérico. Para una app de caja que se usa en el mostrador de un comercio (conectividad variable), esto importa: un cajero sin señal ve el mismo mensaje que si hubo un error de datos, y no sabe si reintentar sirve.

**🟡 Doble submit no bloqueado de forma uniforme** — `AperturaCajaModal.jsx:8`, `CierreCajaModal.jsx:20`: el botón se deshabilita vía `disabled={procesando}`, pero el `onKeyDown` de Enter en `AperturaCajaModal:22` no chequea `procesando`, por lo que **Enter repetido mientras la primera request sigue en vuelo puede disparar múltiples llamadas a `confirmar()`** antes de que el primer `procesando=true` se refleje.

**🟢 Bien resuelto:** labels con `htmlFor`/`id` consistentes en los formularios de movimiento y miembros, `aria-pressed`/`aria-expanded`/`aria-selected` usados correctamente en botones toggle y desplegables (`MovimientoModal.jsx:105`, `SelectorLocal.jsx:41,52,60`), estados vacíos (`EmptyState`) con mensaje explicativo en vez de tablas en blanco, y `CajaAcciones.jsx:32-34` explicando por qué un usuario no puede operar en vez de solo ocultar botones — coherente con el comentario de `RoleGate.jsx:9-11` sobre no esconder sin explicar.

---

## Ranking de prioridad

**Crítico**
1. Condición de carrera en apertura de caja entre dos usuarios del mismo local (sección 1) — impacto directo en la confiabilidad de los cierres de caja, que es el corazón del producto.
2. `pages/superadmin.jsx`: arquitectura, seguridad y performance fallan todas a la vez en un panel con acceso a datos de toda la plataforma (secciones 2, 3, 4).

**Alto**
3. Reversa duplicada por carrera entre dos usuarios (sección 1).
4. Validación de montos solo client-side, sin tope ni saneo de `Number.isFinite` (sección 1) — combinado con la duda sobre si hay `CHECK` constraints en DB.
5. `handleActualizarUsuario` desincroniza `perfiles.email` de `auth.users.email` (sección 2).
6. Condición de carrera en `useReportes.cargar` sin guarda anti-obsolescencia entre cambios de período (sección 3).
7. `handleSuspenderLocal` reactiva indiscriminadamente miembros que estaban dados de baja por otra razón (sección 1).

**Medio**
8. `useCaja.abrir/cerrar` sin flag de cancelación tras `await` (sección 1).
9. Confianza en el objeto `medio` enviado por el cliente para calcular comisión/acreditación persistida (sección 2) — depende de validación server-side no verificada.
10. Falta de paginación/índices confirmados para queries de período largo (sección 3).
11. Duplicación de acceso directo a Supabase fuera de `lib/services` en `ContactModal` (sección 2/4).
12. Mensajes de error inconsistentes (`err.message` crudo vs. traducido) (sección 5).

**Bajo**
13. Exposición de fragmentos de UUID en la UI sin necesidad (sección 2).
14. `confirm()` nativo en vez de `ConfirmDialog` (sección 5).
15. Sin manejo diferenciado de estado offline (sección 5).
16. Doble submit vía Enter en modales de caja (sección 5).
17. Redondeo con floats en sumas de período largo — riesgo teórico, no confirmado en producción (sección 1).

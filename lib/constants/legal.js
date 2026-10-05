/**
 * Fecha de la versión vigente de los Términos y Condiciones (coincide con
 * "Última actualización" en TERMINOS_Y_CONDICIONES.md). Cuando el documento
 * cambie, alcanza con actualizar este valor: todo el mundo —incluidos los que
 * ya habían aceptado la versión anterior— vuelve a ver el aviso obligatorio.
 */
export const VERSION_TERMINOS_ACTUAL = '2026-09-15'

/**
 * Contenido tal cual TERMINOS_Y_CONDICIONES.md (raíz del repo) — es texto
 * legal, no se reescribe ni se resume acá. Si el documento cambia, se pega
 * de nuevo entero y se actualiza VERSION_TERMINOS_ACTUAL arriba.
 */
export const TERMINOS_TEXTO = `# Términos y Condiciones de Uso — GDT Suite

*Borrador — pendiente de revisión legal antes de publicarse. Este documento no reemplaza el asesoramiento de un abogado.*

**Última actualización**: 15 de septiembre de 2026

## 1. Aceptación

Al registrarte y usar GDT Suite ("la Plataforma"), aceptás estos Términos y Condiciones en su totalidad. Si no estás de acuerdo, no debés usar la Plataforma.

## 2. Qué es GDT Suite

GDT Suite es una herramienta de gestión de caja, cobros, gastos y reportes para comercios. Es una herramienta de **apoyo administrativo**, no un servicio de asesoramiento contable, impositivo ni legal. El uso de los reportes, cálculos de IVA, y cualquier otro dato generado por la Plataforma es responsabilidad exclusiva del usuario — GDT Suite no garantiza que sean suficientes o correctos para el cumplimiento de obligaciones fiscales ante AFIP u otro organismo, y recomienda siempre la validación de un contador matriculado.

## 3. Cuenta y responsabilidad del usuario

- El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso, y de toda actividad que ocurra en su cuenta.
- El usuario es responsable de la exactitud de los datos que carga (montos, medios de pago, condición fiscal, y cualquier otro dato ingresado manualmente).
- El usuario es responsable de gestionar correctamente los roles y permisos de las personas que invita a su cuenta (cajeros, empleados).

## 4. Integraciones con terceros (Mercado Pago y otros)

GDT Suite se integra con servicios de terceros, como Mercado Pago, para procesar cobros de suscripción y, opcionalmente, para detectar movimientos en la cuenta de Mercado Pago del propio comercio. Sobre esto:

- GDT Suite **no es responsable** por fallas, interrupciones, cambios, o errores originados en los sistemas de Mercado Pago o de cualquier otro tercero, fuera de su control.
- La detección automática de cobros (por código QR, Point, o transferencias) es una **ayuda administrativa**, no una fuente de verdad definitiva. Ningún movimiento se registra en la caja sin que el usuario lo confirme explícitamente. El usuario es responsable de verificar cada movimiento antes de confirmarlo.
- GDT Suite no garantiza que la detección de movimientos sea exhaustiva o esté libre de errores — puede haber movimientos que no se detecten automáticamente, y es responsabilidad del usuario reconciliar su caja con sus propios registros de Mercado Pago cuando lo considere necesario.

## 5. Disponibilidad del servicio

GDT Suite hace un esfuerzo razonable para mantener la Plataforma disponible, pero no garantiza un funcionamiento ininterrumpido, libre de errores, ni disponibilidad continua. No se responsabiliza por pérdidas derivadas de interrupciones del servicio, caídas de infraestructura de terceros (hosting, base de datos), o mantenimientos programados o de emergencia.

## 6. Limitación de responsabilidad

En la máxima medida permitida por la ley aplicable, GDT Suite, sus creadores, y cualquier socio o colaborador vinculado a su desarrollo u operación, **no serán responsables** por daños indirectos, incidentales, especiales, o lucro cesante derivados del uso o la imposibilidad de uso de la Plataforma, incluyendo pero no limitado a: pérdida de datos, pérdida de ingresos, errores en el cálculo de impuestos, o discrepancias en la caja.

Esta limitación no aplica en los casos en que la ley no permita su exclusión (por ejemplo, dolo o fraude).

## 7. Suscripción y pagos

- Los pagos de suscripción se procesan a través de Mercado Pago. GDT Suite no almacena datos de tarjetas ni información financiera sensible del usuario.
- Los precios de los planes pueden modificarse; los cambios rigen para suscripciones nuevas o renovaciones futuras, nunca de forma retroactiva sobre lo ya pagado.
- La cancelación de la suscripción puede solicitarse en cualquier momento, según lo descripto dentro de la propia Plataforma.

## 8. Modificaciones

GDT Suite puede modificar estos términos en cualquier momento. Los cambios se comunicarán a través de la Plataforma (por ejemplo, mediante el sistema de anuncios), y el uso continuado después de una modificación implica su aceptación.

## 9. Ley aplicable

Estos términos se rigen por las leyes de la República Argentina. Cualquier disputa se someterá a los tribunales competentes de **Buenos Aires, Argentina** *(valor por defecto — confirmar el domicilio real del titular antes de publicar)*.

## 10. Contacto

Para consultas sobre estos términos: supportfranquicias@gmail.com
`

/** Política de Privacidad — texto tal cual POLITICA_DE_PRIVACIDAD.md (raíz del repo). */
export const PRIVACIDAD_TEXTO = `# Política de Privacidad — GDT Suite

*Borrador — pendiente de revisión legal antes de publicarse.*

**Última actualización**: 22 de septiembre de 2026

## 1. Qué datos recolectamos

- **Al registrarte**: nombre, email, contraseña (encriptada, nunca visible ni siquiera para nosotros).
- **Al crear un local**: nombre del negocio, rubro, condición fiscal.
- **Al operar la caja**: montos de cobros y gastos, medios de pago usados, y — si elegís conectar Mercado Pago — los movimientos que esa cuenta detecta.
- **Si conectás Mercado Pago**: la dirección de tu local y su ubicación geográfica (solo si aceptás el permiso de geolocalización del navegador — es opcional, y el flujo sigue funcionando si lo rechazás).
- **No recolectamos** más datos de los necesarios para operar la Plataforma. No usamos rastreo publicitario, ni vendemos ni compartimos datos con terceros para fines de marketing.

## 2. Para qué se usan

Exclusivamente para brindar el servicio: mostrar tu caja, generar tus reportes, procesar tu suscripción, y — si lo activás — conciliar los cobros de tu propia cuenta de Mercado Pago.

## 3. Con quién se comparte

- **Supabase** (alojamiento de la base de datos) y **Vercel** (alojamiento de la aplicación) — como proveedores de infraestructura, no como terceros con acceso independiente a tus datos.
- **Mercado Pago** — para procesar el cobro de tu suscripción, y — si lo conectás — para leer los movimientos de tu propia cuenta.
- No se comparten datos con nadie más, salvo que la ley lo exija.

## 4. Tus derechos

Podés pedir acceso, corrección o eliminación de tus datos en cualquier momento, escribiendo a [supportfranquicias@gmail.com](mailto:supportfranquicias@gmail.com). Algunos datos (como el historial de transacciones ya confirmadas) pueden conservarse por obligaciones fiscales, aunque canceles tu cuenta.

## 5. Seguridad

Las contraseñas se almacenan encriptadas. Las credenciales de acceso a servicios de pago (Mercado Pago) nunca son visibles ni accesibles desde el navegador — se manejan exclusivamente en el servidor. Las comunicaciones entre tu dispositivo y la Plataforma viajan cifradas (HTTPS).

## 6. Retención de datos

Conservamos tus datos mientras tu cuenta esté activa. Si la cancelás, los datos de transacciones ya generadas pueden conservarse por el plazo que exija la normativa fiscal aplicable, incluso si el resto de tu cuenta se elimina.

## 7. Cambios a esta política

Puede actualizarse; los cambios se comunican dentro de la Plataforma.

## 8. Contacto

[supportfranquicias@gmail.com](mailto:supportfranquicias@gmail.com)
`

/** Política de Reembolsos — texto tal cual POLITICA_DE_REEMBOLSOS.md (raíz del repo). */
export const REEMBOLSOS_TEXTO = `# Política de Reembolsos — GDT Suite

*Borrador — pendiente de revisión legal antes de publicarse.*

**Última actualización**: 22 de septiembre de 2026

## 1. Prueba gratuita

Cada cuenta nueva accede a 7 días de prueba gratuita con acceso completo. No se cobra nada durante ese período — no hace falta cancelar nada si decidís no continuar.

## 2. Suscripciones pagas

- Los planes se cobran de forma recurrente (mensual o anual, según lo que elijas) a través de Mercado Pago.
- El cobro se realiza al momento de contratar el plan, y luego en cada renovación del ciclo elegido.

## 3. Cancelación

Podés cancelar tu suscripción en cualquier momento, desde la propia Plataforma (Admin → Suscripción) o directamente desde Mercado Pago. La cancelación detiene los cobros futuros — **no genera un reembolso del período ya pagado**, salvo que la ley aplicable disponga lo contrario.

## 4. Reembolsos

Como regla general, los pagos ya procesados no son reembolsables, dado que el acceso a la Plataforma durante el período pagado ya fue provisto. Casos excepcionales (un error de cobro, un cobro duplicado, o una falla comprobada del servicio) se evalúan de forma individual, escribiendo a [supportfranquicias@gmail.com](mailto:supportfranquicias@gmail.com).

## 5. Cambio de plan

Si cambiás de plan durante un ciclo ya pagado, el cambio rige desde el próximo ciclo de facturación — no se prorratea el período en curso.

## 6. Contacto

Para cualquier consulta sobre cobros o cancelaciones: [supportfranquicias@gmail.com](mailto:supportfranquicias@gmail.com)
`

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

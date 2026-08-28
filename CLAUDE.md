\# GDT Suite



App de gestión de caja diaria para comercios de barrio en Argentina.

Next.js 14 (pages router) + Supabase + Tailwind.



\## Quiénes la usan

\- \*\*Dueño\*\*: abre y cierra la caja, registra cobros y gastos, ve el resultado del día.

\- \*\*Cajero\*\*: opera la caja, no ve administración.

\- \*\*Contador\*\* (indirecto): recibe el PDF/Excel del módulo de reportes.



\## Reglas de arquitectura

\- `lib/domain/\*`: lógica de negocio pura. No importa React ni Supabase. Es lo testeado.

\- `lib/services/\*`: ÚNICO lugar con `supabase.from()`. Excepciones actuales a corregir:

&#x20; `pages/superadmin.jsx` y `pages/index.js`.

\- `hooks/\*`: combinan services + estado.

\- `pages/\*`: solo composición. Ninguna página debería pasar de 200 líneas.



\## Reglas de dominio (importantes)

\- \*\*Todas las fechas se calculan en hora local\*\* (Argentina, UTC-3). Nunca

&#x20; `toISOString().split('T')\[0]` para "hoy": después de las 21:00 devuelve mañana.

&#x20; Usar `lib/dates.js`.

\- \*\*Nada se borra\*\*: una transacción se anula con una reversa (`es\_reversa`), y la

&#x20; original queda marcada `revertida`. Ninguna de las dos suma a los totales, pero la

&#x20; original sí se muestra tachada en la caja.

\- Cada cobro guarda su comisión, IVA y fecha de acreditación \*\*al momento de crearse\*\*.

&#x20; Cambiar la comisión de un medio de pago no reescribe el pasado.

\- Los reportes fiscales no inventan datos: si falta el comprobante, se informa.

\- Una persona tiene el mismo rol en todos sus locales (validado por trigger en la base).



\## Comandos

\- `npm run dev`

\- `npm test` (vitest, 43 tests)

\- `npm run build`



\## Contexto de negocio

Todavía no lo usa ningún comercio real. El objetivo inmediato es que un comerciante

lo pruebe una semana. Los bugs que afectan el arqueo de caja son los más caros:

es lo que el dueño compara contra su cuaderno.


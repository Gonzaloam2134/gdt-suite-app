# Plan: conectar la cuenta de Mercado Pago de cada comerciante — para Claude Code

Pegá esto después de `CLAUDE.md`. Proyecto DISTINTO al cobro de suscripciones
— comparte el patrón de OAuth con Mercado Pago, pero la cuenta que se
conecta acá es la del **comerciante**, no la de GDT Suite.

---

## 0. Decisiones de producto ya tomadas — no las vuelvas a discutir

- **Modelo Opción A confirmado**: una sola cuenta de Mercado Pago por dueño.
  Los locales se distinguen usando **Store** y **Punto de venta (POS)** —
  conceptos que existen dentro de la cuenta de Mercado Pago del comerciante,
  no algo que inventemos nosotros. El dueño mapea cada local suyo a un
  Store/POS de MP una sola vez, después de conectar (tabla `mapeo_locales_mp`).
- **Prerrequisito real, no controlado por nosotros**: el comerciante tiene
  que haber configurado sus locales como Sucursales/Puntos de venta DENTRO
  de su propia cuenta de Mercado Pago antes de que esto sirva de algo. Si no
  lo hizo, todo le va a llegar sin poder distinguir de qué local salió. Esto
  hay que explicárselo claro en la UI de conexión, no asumir que ya está hecho.
- **Nunca se carga un cobro automático a la caja.** Todo entra a una cola de
  "por confirmar" (`movimientos_mp_pendientes`). El dueño o un cajero lo
  confirma con un toque, y recién ahí se convierte en una fila real de
  `transacciones`. No negociable sin volver a hablarlo.
- **Soportamos Point y QR, los dos** — no solo QR.
- **Tópico de webhook: `order`**, para QR y Point únicamente (confirmado
  contra la documentación oficial). No confundir con el webhook de
  suscripciones, que sigue usando `payment`/`subscription_preapproval` en
  su propia aplicación, sin relación con esto.
- **CONFIRMADO — límite real, no técnico**: una transferencia común a
  CVU/alias **no tiene ningún webhook documentado**, ni `order` ni
  `payment` — solo se puede detectar consultando la cuenta periódicamente
  (polling), nunca en tiempo real como QR/Point.
- **CONFIRMADO — otro límite real**: una transferencia común **no trae
  `store_id`/`pos_id`** — no hay forma automática de saber a qué local
  pertenece si el dueño tiene más de un local en la misma cuenta. Por eso
  `movimientos_mp_pendientes.local_id` es NULLABLE: para QR/Point se
  completa solo; para transferencias, si el dueño tiene un solo local se
  autocompleta igual (sin ambigüedad posible), pero si tiene varios, queda
  sin asignar hasta que el dueño elige a mano al confirmar.

---

## 1. Prerrequisitos — hacelos vos antes de pasarle esto a Code

- [ ] 1.1 — Verificar en el panel de Developers si tu aplicación actual
      puede agregar los productos **Point** y **QR Code**, o si hace falta
      una aplicación nueva (los dos casos existen documentados según el
      tipo de integración).
- [ ] 1.2 — Configurar la Redirect URL para el OAuth:
      `https://gdt-suite.vercel.app/api/mercadopago-cliente/callback`
- [ ] 1.3 — Cargar variables de entorno nuevas (separadas de las de
      suscripciones):
      ```
      MERCADOPAGO_MARKETPLACE_CLIENT_ID=...
      MERCADOPAGO_MARKETPLACE_CLIENT_SECRET=...
      ```
- [ ] 1.4 — Configurar el webhook de esta aplicación con el tópico **"Order
      (Mercado Pago)"** — mismo procedimiento que ya usamos para
      suscripciones (Modo de prueba primero, Modo productivo después),
      pero en ESTA aplicación, con SU secreto propio. No hace falta
      suscribir `payment` acá — no aplica a transferencias comunes
      (confirmado), y las de QR/Point ya vienen por `order`.

---

## 2. Mecánica de OAuth (confirmada — ver también PLAN_MERCADOPAGO_PARA_CODE.md sección 2, es la misma API)

Mismo endpoint único `/oauth/token`, mismos tres grant_type, el
access_token dura 180 días, cada renovación devuelve un refresh_token
NUEVO que hay que volver a guardar. PKCE recomendado. El `code` de
autorización vale 10 minutos.

Al completar la autorización, además de los tokens, Mercado Pago devuelve
el `user_id` del comerciante conectado — guardarlo en `mp_user_id`.

---

## 3. Qué construir

### Fase A — Conexión, dirección y creación automática de Store/POS

**Confirmado con la IA de Mercado Pago**: no hace falta que el comerciante
tenga Sucursales/Cajas configuradas de antemano — las creamos nosotros por
API, en su nombre, con su propio `access_token` (permiso `write`).

- [ ] **Pedir la dirección del local, solo en este momento** (no en el alta
      del local — muchos rubros no van a usar esto nunca). Antes de iniciar
      el OAuth, si el local no tiene `direccion`/`ciudad`/`provincia`
      cargados, mostrar una pantalla pidiéndolos, con una explicación breve
      de por qué (Mercado Pago la necesita para crear la Sucursal asociada a
      los cobros de este local). Guardar en `locales` (columnas nuevas en la
      migración).
- [ ] **CONFIRMADO — latitud/longitud son obligatorias, no opcionales.** La
      guía oficial de MP dice textualmente que completarlas mal "puede
      causar errores en los cálculos de impuestos". No alcanza con texto
      de ciudad/provincia. Solución sin costo: pedir permiso de
      geolocalización del navegador (`navigator.geolocation`) en el
      momento de conectar — el dueño casi seguro está parado en su local.
      Guardar `latitud`/`longitud` junto con la dirección escrita.
- [ ] `pages/api/mercadopago-cliente/conectar.js` — arma la URL de
      autorización (con PKCE), la devuelve.
- [ ] `pages/api/mercadopago-cliente/callback.js` — intercambia el `code`
      por tokens, guarda en `conexiones_mercadopago` (Service Role).
- [ ] Después de conectar, para cada local que el dueño quiera activar:
      1. Derivar `external_store_id` = `local_id` sin guiones (ej.
         `35d5406bd8b94c2ca3117c5f633cf404`), y `external_id` del POS =
         eso + sufijo **sin guion** (CONFIRMADO: el external_id de POS
         solo admite alfanumérico, ni guiones ni otros caracteres) —
         ej. `35d5406bd8b94c2ca3117c5f633cf404POS1` para la primera caja,
         cuidando no pasar los 40 caracteres de límite.
      2. Buscar si ya existe: `GET /users/{mp_user_id}/stores/search`
         filtrando por ese `external_id`.
      3. Si no existe, crear: `POST /users/{mp_user_id}/stores`. Payload
         confirmado:
         ```json
         {
           "name": "<nombre del local>",
           "external_id": "35d5406bd8b94c2ca3117c5f633cf404",
           "location": {
             "street_name": "<direccion>",
             "city_name": "<ciudad>",
             "state_name": "<provincia>",
             "latitude": <de navigator.geolocation>,
             "longitude": <de navigator.geolocation>
           }
         }
         ```
         `external_id` de Store admite hasta 60 caracteres (alfanumérico,
         a diferencia del de POS que es más estricto).
      4. Buscar/crear el POS igual, con `GET /pos` / `POST /pos`. Payload
         confirmado (ejemplo real, con `store_id` = el `id` numérico que
         devolvió la creación de la Store en el paso anterior):
         ```json
         {
           "name": "Caja 1",
           "fixed_amount": true,
           "store_id": 1234567,
           "external_store_id": "35d5406bd8b94c2ca3117c5f633cf404",
           "external_id": "35d5406bd8b94c2ca3117c5f633cf404POS1"
         }
         ```
         `fixed_amount: true` — CONFIRMADO con MP: no significa "precio
         fijo para siempre", significa "quién escribe el monto al momento
         de cobrar". Como el cajero carga el monto (no el cliente
         escaneando libremente un QR abierto), `true` es lo correcto — el
         monto variable de cada venta se resuelve creando una `Order`
         distinta por transacción, con su propio `total_amount`.
      5. Guardar el resultado en `mapeo_locales_mp` (local_id ↔ mp_store_id
         ↔ mp_pos_id) — automático, sin que el dueño tenga que buscar nada
         a mano en el panel de Mercado Pago.
- [ ] UI en Admin: "Conectar Mercado Pago" (solo dueño) — ya NO hace falta
      la advertencia de "configurá tus sucursales antes", queda resuelto solo.

### Fase B — Webhook en tiempo real (solo QR/Point)
- [ ] `pages/api/webhooks/mercadopago-cliente.js` (ruta NUEVA, separada del
      webhook de suscripciones) — valida firma (mismo mecanismo HMAC ya
      probado), topic `order`.
- [ ] Al recibir, `GET /v1/orders/{order_id}` (usando el `access_token` DEL
      COMERCIANTE conectado, no el de GDT Suite) para el detalle.
- [ ] Identificar `store_id`/`pos_id` del order → buscar en
      `mapeo_locales_mp` → completar `local_id` directamente (siempre se
      puede asignar solo, para QR/Point).
- [ ] Insertar en `movimientos_mp_pendientes` — `unique(owner_id,
      mp_payment_id)` evita duplicados.

### Fase C — Backfill, conciliación y TRANSFERENCIAS
- [ ] Job de backfill al conectar por primera vez: `GET /payments/search`
      con el rango de fechas que se quiera importar.
- [ ] Job periódico (Vercel Cron — definir frecuencia; cuidado con el
      límite de "misma búsqueda repetida en menos de un minuto" que reportó
      la propia documentación) que hace dos cosas:
      - Re-consulta órdenes de QR/Point del período reciente, por si algún
        webhook no llegó (conciliación).
      - Busca pagos que NO vinieron de una order (transferencias comunes) —
        confirmar contra la documentación real el filtro/atributo exacto
        que permite distinguir este caso en `/payments/search` antes de
        programarlo, no asumirlo.
- [ ] Para las transferencias encontradas: si la cuenta conectada tiene UN
      SOLO local mapeado, completar `local_id` automáticamente. Si tiene
      más de uno, insertar con `local_id = null`.
- [ ] Antes de cada corrida, chequear `vence_en` de la conexión y renovar
      el token si está por vencer.

### Fase D — Confirmar en la app
- [ ] Sección "Por confirmar" en el dashboard del local — solo muestra los
      pendientes que YA tienen `local_id` asignado a ese local.
- [ ] Sección aparte, a nivel de CUENTA (no de un local), para las
      transferencias sin asignar (`local_id is null`) — ahí el dueño elige
      a qué local corresponde cada una antes de poder confirmarla.
- [ ] Confirmar → crea `transaccion` real (COBRO_RECIBIDO) en el local que
      corresponda, actualiza el pendiente.
- [ ] Descartar → por si no corresponde a una venta real.

---

## 4. Lo que NO hacer

- No usar el tópico `payment` para QR/Point — es `order`, confirmado.
- No prometerle al usuario que una transferencia común se detecta "al
  instante" — no hay webhook para eso, es honesto decir que depende de la
  próxima conciliación periódica.
- No intentar adivinar a qué local pertenece una transferencia sin
  store_id/pos_id cuando hay más de un local — dejarla sin asignar y que
  el dueño la resuelva, nunca asignarla "a ojo" del lado del código.
- No asumir que el comerciante ya tiene Store/POS configurados — avisarlo
  explícitamente en la UI, con un link a cómo hacerlo en Mercado Pago.
- No cargar nunca un movimiento directo a `transacciones` sin pasar por la
  cola de confirmación.
- No mezclar las credenciales de esta integración con las de
  `MERCADOPAGO_ACCESS_TOKEN` (suscripciones) — son aplicaciones y tokens
  completamente separados.

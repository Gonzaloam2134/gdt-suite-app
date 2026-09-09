-- ============================================================================
-- GDT SUITE — Conectar la cuenta de Mercado Pago de cada comerciante
-- (Opción A: una cuenta de MP por dueño, los locales se distinguen con
-- Store/POS — conceptos que ya existen DENTRO de Mercado Pago)
-- ============================================================================

-- Una sola conexión por dueño — no hay conexiones por local, porque en este
-- modelo todos los locales de un dueño comparten la misma cuenta de MP.
create table if not exists conexiones_mercadopago (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null unique references perfiles(id),
  mp_user_id        text not null,
  access_token      text not null,
  refresh_token     text not null,
  vence_en          timestamptz not null,   -- 180 días desde que se emitió/renovó
  conectado_en      timestamptz not null default now(),
  desconectado_en   timestamptz             -- null = activa
);

alter table conexiones_mercadopago enable row level security;

-- Nadie lee ni escribe esto desde el navegador: son credenciales de acceso
-- a una cuenta de Mercado Pago ajena. Todo pasa por rutas de servidor con
-- Service Role.
create policy conexiones_mercadopago_sin_acceso_cliente on conexiones_mercadopago
  for all to authenticated using (false) with check (false);

-- ---------------------------------------------------------------------------
-- El mapeo: qué Store/POS de Mercado Pago corresponde a cada local nuestro.
-- Lo carga el dueño una sola vez, después de conectar su cuenta — nosotros
-- no podemos adivinarlo, Mercado Pago no sabe nada de "locales" de GDT Suite.
-- ---------------------------------------------------------------------------
create table if not exists mapeo_locales_mp (
  id            uuid primary key default gen_random_uuid(),
  local_id      uuid not null unique references locales(id),
  mp_store_id   text not null,
  mp_pos_id     text,   -- puede haber más de un POS por store; null = todos los POS de ese store
  creado_en     timestamptz not null default now()
);

alter table mapeo_locales_mp enable row level security;

create policy mapeo_locales_mp_select on mapeo_locales_mp for select to authenticated
  using (es_miembro(local_id) or es_super_user());

create policy mapeo_locales_mp_write on mapeo_locales_mp for all to authenticated
  using (rol_en_local(local_id) = 'owner' or es_super_user())
  with check (rol_en_local(local_id) = 'owner' or es_super_user());

-- ---------------------------------------------------------------------------
-- Cola de "por confirmar" — igual que antes: nada se carga solo a la caja,
-- todo pasa por una confirmación humana.
-- ---------------------------------------------------------------------------
-- `local_id` es OPCIONAL a propósito: QR y Point vienen con store_id/pos_id
-- (ya sabemos a qué local pertenecen, se completa solo). Una transferencia
-- común NO trae esa información — no hay forma automática de saber a qué
-- local pertenece si el dueño tiene más de uno en la misma cuenta de MP.
-- Esas quedan con local_id null hasta que el dueño la asigna a mano al
-- confirmar. Si el dueño tiene un solo local, se autocompleta sin preguntar
-- (no hay ambigüedad posible).
create table if not exists movimientos_mp_pendientes (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references perfiles(id),
  local_id          uuid references locales(id),   -- null = todavía sin asignar (típico en transferencias)
  mp_payment_id     text not null,
  origen            text not null check (origen in ('point', 'qr', 'transferencia')),
  monto             numeric not null,
  descripcion       text,
  fecha_mp          timestamptz not null,
  estado            text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'descartado')),
  transaccion_id    uuid references transacciones(id),
  creado_en         timestamptz not null default now(),
  unique (owner_id, mp_payment_id)
);

alter table movimientos_mp_pendientes enable row level security;

-- Con local_id nulo posible, el acceso se resuelve por owner_id (si sos
-- dueño de la cuenta) o por ser miembro del local ya asignado.
create policy movimientos_mp_pendientes_select on movimientos_mp_pendientes for select to authenticated
  using (
    owner_id = auth.uid()
    or (local_id is not null and es_miembro(local_id))
    or es_super_user()
  );

create policy movimientos_mp_pendientes_update on movimientos_mp_pendientes for update to authenticated
  using (
    owner_id = auth.uid()
    or (local_id is not null and rol_en_local(local_id) in ('owner', 'cajero'))
    or es_super_user()
  )
  with check (
    owner_id = auth.uid()
    or (local_id is not null and rol_en_local(local_id) in ('owner', 'cajero'))
    or es_super_user()
  );

-- ============================================================================
-- Dirección del local — hoy no existe en `locales`, y hace falta para crear
-- la Sucursal (Store) por API en Mercado Pago. Se completa solo cuando el
-- dueño decide conectar Mercado Pago por primera vez, no en el alta del
-- local — muchos rubros (servicios) nunca la van a necesitar.
-- ============================================================================
alter table locales
  add column if not exists direccion text,
  add column if not exists ciudad text,
  add column if not exists provincia text,
  add column if not exists codigo_postal text,
  add column if not exists latitud numeric,
  add column if not exists longitud numeric;

-- latitud/longitud quedan NULLABLE a nivel de base: si el navegador rechaza
-- el permiso de geolocalización, el dueño sigue pudiendo conectar con la
-- dirección escrita a mano. La sección 0 del plan ya confirmó que MP las
-- pide para no tener errores en los cálculos de impuestos, pero eso es una
-- validación de producto al momento de crear la Store (Fase A), no una
-- restricción de esta tabla.

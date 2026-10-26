-- ============================================================================
-- GDT Suite — Cuentas corrientes por cliente (kiosko escolar y similares)
-- ============================================================================
-- Caso de uso: el kiosko de un colegio. Un responsable anota qué compra cada
-- alumno durante el mes, sin cobrar nada en el momento. A fin de mes el padre
-- paga (todo o en partes) y ahí sí entra plata real a la caja.
--
-- Decisiones de alcance (confirmadas con el dueño del producto):
-- 1. Es un dato POR LOCAL, igual que medios_pago — no se comparte entre
--    locales de la misma cuenta.
-- 2. El CONSUMO es solo una deuda: no suma al arqueo del día. Vive en su
--    propia tabla (movimientos_cc), nunca en `transacciones`.
-- 3. Cualquiera que puede registrar un cobro (owner, cajero, empleado —
--    ROLES_REGISTRAN_COBRO en lib/constants/roles.js) puede anotar un consumo.
-- 4. El PAGO sí es plata real: genera un cobro normal en `transacciones`
--    (mismo motor de comisión/IVA/acreditación que cualquier venta) y un
--    movimiento 'pago' en movimientos_cc que lo referencia y baja el saldo.
--    Se permiten pagos parciales — no hace falta saldar todo de una vez.
--
-- Regla de dominio de CLAUDE.md "nada se borra" aplica igual que en
-- `transacciones`: un consumo o un pago mal cargado se anula con una
-- reversa (es_reversa=true, reversa_de=<original>), nunca se hace
-- update/delete sobre una fila ya creada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Clientes con cuenta corriente (el alumno, la familia, el cliente habitual).
-- Esto SÍ se puede editar/dar de baja — es un dato de configuración, como
-- medios_pago, no un registro financiero.
-- ---------------------------------------------------------------------------
create table if not exists clientes_cc (
  id            uuid primary key default gen_random_uuid(),
  local_id      uuid not null references locales(id),
  nombre        text not null,
  -- Dato libre para identificar al cliente sin inventar un campo por rubro:
  -- "4to B", DNI, teléfono de contacto del padre, lo que use cada negocio.
  identificador text,
  activo        boolean not null default true,
  creado_por    uuid references perfiles(id),
  creado_en     timestamptz not null default now()
);

alter table clientes_cc enable row level security;

create policy clientes_cc_select on clientes_cc for select to authenticated
  using (es_miembro(local_id) or es_super_user());

-- Alta/edición/baja: mismo criterio que medios_pago — lo administra quien
-- opera la caja de ese local. (No ROLES_REGISTRAN_COBRO: dar de baja un
-- cliente es más una decisión de "administración" que de "venta del día",
-- igual que medios_pago lo maneja owner/cajero.)
create policy clientes_cc_write on clientes_cc for all to authenticated
  using (rol_en_local(local_id) in ('owner', 'cajero') or es_super_user())
  with check (rol_en_local(local_id) in ('owner', 'cajero') or es_super_user());

create index if not exists clientes_cc_local_idx on clientes_cc (local_id) where activo;

-- ---------------------------------------------------------------------------
-- El libro de movimientos: consumos (deuda) y pagos (plata real cobrada).
-- INSERT-only. Sin update ni delete — ni siquiera para el owner.
-- ---------------------------------------------------------------------------
create table if not exists movimientos_cc (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references clientes_cc(id),
  local_id        uuid not null references locales(id),   -- denormalizado: misma razón que en movimientos_mp_pendientes, simplifica RLS y los índices
  tipo            text not null check (tipo in ('consumo', 'pago')),
  monto           numeric not null,
  descripcion     text,
  -- Solo se completa en un 'pago': el cobro real que generó en `transacciones`
  -- (ahí vive la comisión, el IVA, la acreditación — este movimiento no
  -- duplica esos cálculos, solo apunta a ellos).
  transaccion_id  uuid references transacciones(id),
  es_reversa      boolean not null default false,
  revertida       boolean not null default false,
  reversa_de      uuid references movimientos_cc(id),
  creado_por      uuid references perfiles(id),
  creado_en       timestamptz not null default now()
);

alter table movimientos_cc enable row level security;

create policy movimientos_cc_select on movimientos_cc for select to authenticated
  using (es_miembro(local_id) or es_super_user());

-- Solo INSERT desde el cliente — nunca update ni delete, ni para owner ni
-- para super_user: lo mismo que `transacciones`. Un consumo o pago de más
-- se corrige con una reversa (otro insert), no reescribiendo el original.
create policy movimientos_cc_insert on movimientos_cc for insert to authenticated
  with check (rol_en_local(local_id) in ('owner', 'cajero', 'empleado') or es_super_user());

-- Como máximo una reversa por movimiento original — mismo refuerzo que
-- tx_una_reversa_por_original en MIGRACION_HARDENING_P0_3_REVERSA.sql.
create unique index if not exists cc_una_reversa_por_original
  on movimientos_cc (reversa_de)
  where reversa_de is not null;

create index if not exists movimientos_cc_cliente_idx on movimientos_cc (cliente_id, creado_en desc);

-- Al insertar una reversa, marca la original como `revertida` — así el
-- cliente no tiene que hacer un segundo update (que de cualquier forma la
-- policy de arriba no deja hacer).
create or replace function public.marcar_movimiento_cc_revertido()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.reversa_de is not null then
    update movimientos_cc set revertida = true where id = new.reversa_de;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_marcar_movimiento_cc_revertido on movimientos_cc;
create trigger trg_marcar_movimiento_cc_revertido
  after insert on movimientos_cc
  for each row
  execute function public.marcar_movimiento_cc_revertido();

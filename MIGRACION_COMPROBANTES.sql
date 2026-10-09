-- ============================================================================
-- GDT SUITE — Comprobantes adjuntos a un cobro o gasto
-- (foto/escaneo desde la cámara del celular o un archivo desde la laptop)
-- ============================================================================

-- Un solo archivo por movimiento para arrancar. Nullable: la gran mayoría de
-- los movimientos van a seguir sin comprobante adjunto (no es obligatorio).
alter table transacciones add column if not exists comprobante_path text;

-- ---------------------------------------------------------------------------
-- Bucket privado. Nada se sirve público: toda lectura pasa por una URL
-- firmada de corta duración (`createSignedUrl`), nunca por una URL pública.
-- Límite de 8MB y solo los tipos que de verdad se van a subir desde una
-- cámara o un escaneo — nada de video ni de archivos ejecutables.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Convención de ruta: {local_id}/{transaccion_id}-{algo único}.{ext}
-- `storage.foldername(name)[1]` es el primer segmento de la ruta — el
-- `local_id` — así que la policy se resuelve igual que en el resto de la app:
-- `es_miembro`/`rol_en_local` sobre ese local, nunca mirando el archivo.
-- ---------------------------------------------------------------------------
drop policy if exists comprobantes_select on storage.objects;
create policy comprobantes_select on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and es_miembro((storage.foldername(name))[1]::uuid)
  );

drop policy if exists comprobantes_insert on storage.objects;
create policy comprobantes_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and rol_en_local((storage.foldername(name))[1]::uuid) in ('owner', 'cajero')
  );

-- Reemplazar el comprobante de un movimiento (subir uno nuevo que pisa el
-- anterior con la misma ruta) requiere poder actualizar el objeto, no solo
-- insertarlo — mismo rol que para insertar.
drop policy if exists comprobantes_update on storage.objects;
create policy comprobantes_update on storage.objects for update to authenticated
  using (
    bucket_id = 'comprobantes'
    and rol_en_local((storage.foldername(name))[1]::uuid) in ('owner', 'cajero')
  )
  with check (
    bucket_id = 'comprobantes'
    and rol_en_local((storage.foldername(name))[1]::uuid) in ('owner', 'cajero')
  );

-- Nada se borra (ver CLAUDE.md): sin policy de delete, ni para owner ni para
-- cajero. Un comprobante cargado por error se reemplaza (update), no se
-- elimina.

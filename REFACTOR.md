# Refactor GDT Suite — estado

## Fase 0 (hecha) — limpieza
- Borrados 16 archivos legacy/muertos (pages: medios-pago, payment-methods, equipo, configuracion, cuenta; lib: useRoleCheck, useUserRole; components: ExportModal, ProtectedRoute, AddUserModal, InviteUserModal, OnboardingEmpleado, userinfo, BottomNav viejo; utils/excelExport; cambios.txt)
- `.next/` fuera de git
- `xlsx-js-style` desinstalado
- `toast.warning` → `toast(msg, { icon })` (2 lugares en locales.js)
- `tarjeta_credito/debito` → `credito/debito` en admin.jsx (coincide con DB y check constraint)

## Fase 1 (hecha) — cimientos
```
lib/
  supabaseClient.js         limpio, falla rápido si faltan env vars
  format.js                 formatCurrency, formatNumber, formatHora, formatFecha, formatFechaHora, formatFechaLarga
  dates.js                  hoyISO, rangoDia, rangoEntre, periodoRapido — SIEMPRE hora local
  constants/                roles, mediosPago, auditoria, transacciones
  domain/transacciones.js   calcularTotalesDia, calcularResumenPeriodo, calcularIva, calcularComision… (puro, testeado)
  services/                 auth, locales, miembros, mediosPago, transacciones, cierresCaja, suscripciones, anuncios, contactos, auditoria, superadmin
  UserRoleContext.jsx       fail-closed; expone cambiarLocal() y recargar()
hooks/
  useAuthGuard, useActiveLocal, useUserRole, useIsMobile, usePaginacion, useClickOutside, useSignOut
components/
  ui/                       Modal, ConfirmDialog, LoadingScreen, EmptyState, SeccionColapsable
  layout/BottomNav.jsx      único, 4 tabs, Admin oculto para cajero/empleado
  RoleGate.jsx              fail-closed, usa el context
tests/                      vitest — 20 tests (fechas en hora local, totales del día, reversas, IVA)
```

Reglas:
- `lib/domain/*` no importa React ni Supabase.
- `supabase.from(...)` SOLO en `lib/services/*`. Las páginas y componentes usan services.
- Ninguna página > 200 líneas, ningún componente > 150, ninguna función > 40.

## Bugs que quedan en las páginas viejas hasta que se refactoricen (Fase 2+)
Las páginas todavía usan su código original. Se corrigen al migrarlas a los cimientos:
- dashboard/admin/reportes: fechas UTC → usar lib/dates
- dashboard/admin/reportes: revertidas siguen sumando → usar lib/domain (esValida)
- admin: getElementById, handleEditRole pisa rol_global → usar services/miembros.cambiarRol
- admin: invitaciones con nombre_invitado (columna inexistente) → services/miembros.crearInvitacion
- superadmin: configuracion_global ahora existe; suspender local → services/locales.setLocalActivo
- reportes: IVA fijo 21% → calcularResumenPeriodo lee monto_iva guardado
- CobroModal/GastoModal: usar services/transacciones.registrarCobro/Gasto (persisten alícuota, comisión, comprobante)
- locales: anuncios leídos → services/anuncios (tabla anuncios_leidos)

## Fase 2 (hecha) — dashboard 1640 → 100 líneas
```
pages/dashboard.jsx              100   solo composición
hooks/useCaja.js                  79   abrir/cerrar/historial
hooks/useTransaccionesDia.js      35   carga + totales (domain)
components/caja/
  CajaHeader.jsx                  64
  CajaAcciones.jsx                32
  KpiCards.jsx / KpiCard.jsx      46 / 38
  ListaTransacciones.jsx          90   cobros y gastos, mobile+desktop
  AcreditacionesDelDia.jsx        40
  DesgloseMedios.jsx              55
  AperturaCajaModal.jsx           28
  CierreCajaModal.jsx             70
  HistorialCierresModal.jsx       46
components/MovimientoModal.jsx   170   reemplaza CobroModal + GastoModal
components/ReversaModal.jsx       57   reescrito sobre services
```

Corregido en esta fase:
- Fechas en hora local (antes UTC): un cobro a las 22:30 ya suma al día correcto
- Transacciones revertidas dejan de sumar (bug de doble conteo)
- Cobros/gastos persisten alicuota_iva, monto_iva, monto_neto, comision_monto,
  fecha_acreditacion_estimada y tipo_comprobante → los reportes leen datos reales
- Comprobante e IVA por defecto según locales.condicion_fiscal; se ocultan para
  Monotributo/Exento
- Cobro y Gasto deshabilitados si la caja no está abierta
- RoleGate en las acciones de caja (coincide con la RLS: solo owner y cajero)
- 8 tarjetas KPI duplicadas → 1 componente; 4 listas duplicadas → 1
- Modales sobre components/ui/Modal (Escape, clic afuera, foco)

## Fase 3 (hecha) — admin 1162 → 92 líneas
```
pages/admin.jsx                    92
hooks/useAdminData.js              66   stats del período, miembros, medios, logs
components/admin/
  AdminHeader.jsx                  25
  Tabs.jsx                         13
  FiltroPeriodo.jsx                59   reutilizable por reportes (Fase 5)
  ResumenTab.jsx                   25
  MiembrosTab.jsx                 131
  EditarMiembroModal.jsx           50
  MediosPagoTab.jsx               120
  ListaLogs.jsx                    35
```

Corregido en esta fase:
- Editar miembro ya NO pisa perfiles.rol_global (antes podía degradar a un super_user)
- Invitaciones: se sacó nombre_invitado, columna que no existe → antes fallaba siempre
- Formularios controlados: se eliminaron los 12 document.getElementById
- Stats del período usan calcularResumenPeriodo → excluyen reversas y revertidas
  (antes admin, dashboard y reportes daban tres números distintos para el mismo día)
- Fechas del filtro en hora local (lib/dates.periodoRapido)
- confirm() → ConfirmDialog
- El bloque super_user salió de admin: /admin administra UN local, /superadmin es global
- Cajero y empleado comparten una vista simple de su propia actividad

## Ajustes post-fase 3
- Transacciones canceladas: se muestran en la caja tachadas y con etiqueta
  "Cancelado" (y el motivo al expandir), pero no suman a ningún total.
  El asiento inverso queda en la DB pero no se lista como movimiento propio:
  contablemente prolijo por detrás, claro para el dueño adelante.
- El badge de cada lista muestra "N + M cancelados" cuando hay anulaciones.
- Anuncios leídos ahora en la tabla anuncios_leidos (antes localStorage):
  ya no reaparecen al cambiar de dispositivo o limpiar el navegador.
  Nuevo hooks/useAnuncios.js; se limpiaron los console.log de locales.js.

## Próximo: Fase 4 — superadmin.jsx (934 → ~100)

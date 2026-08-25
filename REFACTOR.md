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

## Próximo: Fase 2 — dashboard.jsx (1640 → ~150)

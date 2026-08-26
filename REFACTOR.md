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

## Fase 5 (hecha) — reportes 663 + lib/reportes 454 → módulo del contador
```
pages/reportes.js                 108
hooks/useReportes.js               85
lib/domain/reportes.js            110   agrupaciones puras + calidad del dato
lib/export/pdf.js                 113   (reemplaza generarReportePDF)
lib/export/excel.js               119   (reemplaza generarReporteExcel)
components/reportes/
  FiltrosReporte.jsx               61
  AvisosCalidad.jsx                27
  ResumenEjecutivo.jsx             48
  ResumenPorAlicuota.jsx           43
  MediosYConciliacion.jsx          88
  TablaLibro.jsx                   77
components/ReportGuide.jsx            reciclado como "¿Cómo leer esto?"
```

Corregido en esta fase:
- Se dejaron de inventar datos fiscales: antes TODO salía como "Factura A", punto de
  venta "0001", número = 8 chars del UUID e IVA 21% calculado al vuelo. Ahora se lee
  tipo_comprobante, punto_venta, nro_comprobante, alicuota_iva y monto_iva reales
- locales.condicion_fiscal decide si se discrimina IVA (Monotributo no lo ve)
- Consolidado de varios locales: solo discrimina IVA si TODOS lo hacen
- Panel de calidad del dato arriba de los números (cuántos movimientos sin comprobante,
  sin número, sin alícuota, cuántos anulados)
- Conciliación de caja real: días que cuadraron, faltantes, sobrantes, cierres sin contar
- resumen.pendiente que nunca se calculaba y "saldo inicial: 0" hardcodeado: eliminados
- Exportables listos para entregar al contador (xlsx → exceljs, con formato real):
  * Excel: 7 hojas (Resumen, IVA Ventas, IVA Compras, Resumen IVA, Medios de pago,
    Libro caja, Conciliación) con encabezados de color, cebra, bordes, formato de
    moneda, autofiltro y panel fijo en los libros, y diferencias de caja pintadas
    según cuadre/faltante/sobrante. Importes como números: se pueden sumar.
  * PDF: portada con las tres cifras clave, secciones tituladas, tablas con totales,
    numeración de páginas y pie legal
  * Nº de comprobante formateado 0001-00000123
  * Ambos exportadores se cargan bajo demanda (la página pasó de 414 kB a 12 kB)
  * construirLibro() y construirPDF() separados de la descarga → 14 tests los cubren

## Fase 6 (hecha) — navegación, invitaciones y medios de pago editables

### Navegación
- `components/layout/AppHeader.jsx`: cabecera única con selector de local SIEMPRE
  visible. En desktop lleva los accesos (Caja / Reportes / Admin / Mis locales);
  en mobile eso lo cubre BottomNav.
- `components/layout/SelectorLocal.jsx`: cambia de local desde cualquier pantalla.
  "Todos los locales" solo en Reportes: una caja o un panel de miembros son de un
  local puntual, consolidarlos no significa nada.
- BottomNav ahora aparece también en la pantalla de inicio (antes desaparecía) y
  sus tabs son Inicio / Caja / Reportes / Admin.
- `pages/locales.js` (448 → 172) es la pantalla de inicio: tarjeta por local con
  cobros, gastos, movimientos del día y si la caja está abierta, más el consolidado
  de todos los locales arriba.

### Invitaciones (el flujo nunca había estado completo: no existía dónde aceptarlas)
- `pages/invitacion.jsx`: pantalla que abre quien recibe el link. Si no tiene cuenta,
  lo lleva a registrarse y vuelve solo a aceptar.
- Link copiable y botón "Enviar por WhatsApp" — para un comercio de barrio el mail
  suele no ser el canal real.
- Invitaciones pendientes con renovar (si venció) y cancelar.
- Miembros quitados se pueden reincorporar.
- Requiere la migración MIGRACION_INVITACIONES.sql (RPC ver_invitacion y
  aceptar_invitacion, más la columna nombre_invitado).

### Medios de pago
- Ahora se pueden editar (nombre, tipo, comisión, plazo).
- Al cambiar comisión o plazo se avisa que rige de ahí en adelante: cada cobro guarda
  la comisión con la que se hizo, así que los reportes anteriores no cambian.

## Próximo: suscripciones con Mercado Pago, y por último Fase 4 — superadmin (KPIs de triage)

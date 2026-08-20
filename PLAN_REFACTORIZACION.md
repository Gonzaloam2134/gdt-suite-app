#  Plan de Refactorización - GDT Suite

**Objetivo:** Transformar un monolito de 1200+ líneas en una arquitectura modular, mantenible y escalable.

**Duración estimada:** 3-4 semanas (trabajando tranquilo, sin apuro)

**Filosofía:** Pequeños pasos concretos. Cada día termina con el proyecto FUNCIONANDO.

---

## 📊 Estado Actual

- ✅ MVP completo y funcional
- ✅ Flujo de caja funcionando
- ✅ Reportes generados
- ❌ Código acoplado (dashboard.js = 1200+ líneas)
- ❌ Lógica mezclada con UI
- ❌ Sin reutilización de código
- ❌ Sin tests

---

## 🎯 Estado Final (Meta)

- ✅ `dashboard.js` = ~150 líneas (solo render)
- ✅ Lógica de negocio en `lib/` (testeable)
- ✅ Hooks personalizados en `hooks/` (reutilizables)
- ✅ Componentes atómicos en `components/`
- ✅ Features organizadas por dominio
- ✅ Máximo 200 líneas por archivo
- ✅ Código legible y mantenible

---

## ️ FASE 1: Estabilización (3 días)

**Objetivo:** Asegurar que el MVP funciona perfecto antes de tocar código.

### Día 1.1 - Test del Flujo Completo

**Tarea:** Ejecutar manualmente este flujo y anotar TODO bug encontrado:

✓ Crear cuenta nueva
✓ Crear local
✓ Configurar 2 medios de pago (efectivo + tarjeta)
✓ Abrir caja con $1000
✓ Registrar 3 cobros (1 efectivo, 1 tarjeta, 1 transferencia)
✓ Registrar 1 gasto
✓ Cerrar caja con conciliación
✓ Ver el log de auditoría
✓ Ir a reportes → exportar PDF
✓ Exportar Excel
✓ Volver al dashboard



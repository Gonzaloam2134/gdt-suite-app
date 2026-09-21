# Plan: Términos y Condiciones — para Claude Code

## Decisiones ya tomadas
- El texto final está en `TERMINOS_Y_CONDICIONES.md` (adjunto, pegalo tal
  cual en la nueva página — no lo reescribas ni resumas).
- **Alcanza a TODOS los usuarios, no solo a los registros nuevos.** Los que
  ya tienen cuenta (dueños, cajeros, empleados) tienen que ver un aviso
  obligatorio la próxima vez que entren, y no pueden seguir usando la app
  sin aceptar.
- Se versiona por fecha (`VERSION_TERMINOS_ACTUAL`), no por un simple
  booleano — así, el día que el documento cambie de nuevo, alcanza con
  actualizar esa constante para que se le vuelva a pedir la aceptación a
  todo el mundo, incluidos los que ya habían aceptado la versión anterior.

## Base de datos
Migración nueva:
```sql
alter table perfiles
  add column if not exists terminos_aceptados_en timestamptz,
  add column if not exists terminos_version text;
```

## Código

1. **`lib/constants/legal.js`** — `export const VERSION_TERMINOS_ACTUAL = '2026-09-15'`
   (coincide con la fecha de "Última actualización" del documento).

2. **`pages/terminos.jsx`** — página pública (sin auth guard), muestra el
   contenido completo de `TERMINOS_Y_CONDICIONES.md` con buen formato.
   Accesible sin sesión (para poder linkearla desde el registro antes de
   que exista la cuenta).

3. **`pages/registro.jsx`** — agregar un checkbox obligatorio "Acepto los
   [Términos y Condiciones](/terminos)" (el link abre en pestaña nueva).
   El botón de registro queda deshabilitado hasta que se tilda. Al crear
   la cuenta, guardar `terminos_aceptados_en = now()` y
   `terminos_version = VERSION_TERMINOS_ACTUAL` en el mismo insert de perfiles.

4. **Un guard nuevo, compartido, para usuarios EXISTENTES**:
   - `hooks/useTerminosGuard.js` — dado un `userId`, consulta
     `perfiles.terminos_version`; si es distinto (o null) a
     `VERSION_TERMINOS_ACTUAL`, devuelve `debeAceptar: true`.
   - `components/TerminosBloqueoModal.jsx` — modal que NO se puede cerrar
     sin aceptar (sin botón de cerrar, sin click-outside). Muestra el
     texto completo (o un resumen con link a `/terminos` para leerlo
     entero) y un botón "Acepto" que actualiza
     `terminos_aceptados_en`/`terminos_version` y desbloquea.
   - Conectar este guard en los 4 puntos de entrada donde ya hay un
     `useAuthGuard`: `dashboard.jsx`, `admin.jsx`, `reportes.jsx`,
     `superadmin.jsx` — aplica a TODOS los roles (dueño, cajero,
     empleado), cualquiera que use la app está alcanzado.
   - Mientras `debeAceptar` sea true, renderizar SOLO el modal — nada de
     la pantalla de atrás, ni loading states raros detrás.

## Qué NO hacer
- No reescribir el texto de los términos — es contenido legal, se pega
  tal cual viene del archivo.
- No dejar que el modal se pueda saltear (ni con Escape, ni tocando
  afuera, ni navegando a otra URL directamente — el guard tiene que
  aplicar en cada página protegida, no solo en una).
- No perder el historial: si alguien ya había aceptado una versión
  vieja, no se borra ese dato — se sobreescribe con la fecha/versión
  nueva al aceptar la actual (queda como "la última aceptación", no
  hace falta guardar un historial completo de cada versión aceptada).

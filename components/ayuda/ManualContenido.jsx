/**
 * Contenido estático del manual de usuario — capturas reales de la app en
 * `public/manual/`. Es composición pura (sin fetch, sin estado): si el
 * manual cambia, se edita acá, no en pages/ayuda.jsx.
 */
function Seccion({ titulo, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-base font-bold text-gray-900 mb-2">{titulo}</h2>
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  )
}

function Captura({ src, alt }) {
  return (
    <img
      src={`/manual/${src}`}
      alt={alt}
      className="w-full max-w-[300px] rounded-2xl border border-gray-200 shadow-suave mx-auto block"
    />
  )
}

export default function ManualContenido() {
  return (
    <div>
      <p className="text-sm text-gray-700 leading-relaxed mb-8">
        Esta guía es para el dueño o la persona que atiende el local. Cubre lo que se usa todos los
        días: abrir la caja, cobrar, registrar gastos, cerrarla, y mirar los reportes. Cada paso tiene
        una captura real de la aplicación.
      </p>

      <Seccion titulo="1. Entrar y elegir tu local">
        <p>Al entrar con tu usuario, ves la lista de locales a los que tenés acceso. Tocá el que querés abrir.</p>
        <Captura src="01-mis-locales.jpg" alt="Lista de locales" />
        <p>Si solo tenés un local, la app entra directo ahí.</p>
      </Seccion>

      <Seccion titulo="2. Abrir la caja al empezar el día">
        <p>Cuando entrás a Caja y todavía no abriste, ves este aviso. Tocá <strong>Abrir caja</strong>.</p>
        <Captura src="02-caja-cerrada.jpg" alt="Caja cerrada" />
        <p>Te pide el monto inicial en efectivo (lo que hay en la caja antes de empezar a vender). Cargalo y confirmá.</p>
        <Captura src="03-abrir-caja-modal.jpg" alt="Abrir caja" />
        <p>Con la caja abierta, ya podés registrar cobros y gastos durante el día.</p>
        <Captura src="04-caja-abierta.jpg" alt="Caja abierta" />
      </Seccion>

      <Seccion titulo="3. Registrar un cobro">
        <p>Desde Caja, tocá <strong>Cobrar</strong>. Elegí el medio de pago (efectivo, tarjeta, transferencia, QR) y qué vendiste.</p>
        <Captura src="05-cobrar-modal.jpg" alt="Cobrar" />
        <p>Cargá el monto y confirmá.</p>
        <Captura src="06-cobrar-con-monto.jpg" alt="Cobro con monto cargado" />
        <p>El cobro queda registrado en la caja, con su medio de pago y hora.</p>
        <Captura src="07-cobro-registrado.jpg" alt="Cobro registrado" />
        <p>
          Cada medio de pago guarda su comisión y cuándo se acredita, al momento del cobro — si después
          cambiás la comisión de ese medio, los cobros ya hechos no cambian.
        </p>
      </Seccion>

      <Seccion titulo="4. Registrar un gasto">
        <p>Desde Caja, tocá <strong>Gasto</strong>. Describí qué pagaste y con qué medio.</p>
        <Captura src="08-gasto-modal.jpg" alt="Gasto" />
        <p>Cargá el monto y confirmá.</p>
        <Captura src="09-gasto-con-monto.jpg" alt="Gasto con monto cargado" />
        <p>El gasto queda registrado junto a los cobros del día.</p>
        <Captura src="10-gasto-registrado.jpg" alt="Gasto registrado" />
      </Seccion>

      <Seccion titulo="5. Cerrar la caja al final del día">
        <p>
          Al terminar el día, tocá <strong>Cerrar caja</strong>. La app te muestra cuánto efectivo
          debería haber según lo cobrado y gastado — contá el efectivo real y cargalo para ver si coincide.
        </p>
        <Captura src="11-cerrar-caja-modal.jpg" alt="Cerrar caja" />
        <p>
          Una vez cerrada, esa caja queda fija: ya no se le pueden agregar cobros ni gastos. Si cargaste
          algo mal, no se borra — se anula con una reversa, y el original queda tachado pero visible.
        </p>
      </Seccion>

      <Seccion titulo="6. Ver los reportes">
        <p>
          Desde el menú inferior, tocá <strong>Reportes</strong>. Elegí el período (hoy, últimos 30 días, un
          mes puntual) y ves cómo viene el negocio.
        </p>
        <Captura src="12-reportes.jpg" alt="Reportes" />
        <p>
          Más abajo está el detalle: total facturado, por medio de pago, y el resultado del período. Podés
          descargar el reporte en PDF o Excel para mandarlo a tu contador.
        </p>
        <Captura src="13-reportes-secciones.jpg" alt="Secciones del reporte" />
        <p>Si falta algún comprobante, el reporte lo avisa — nunca inventa un dato que no cargaste.</p>
      </Seccion>

      <Seccion titulo="7. Administrar tu local">
        <p>
          Desde el menú inferior, tocá <strong>Más</strong> para llegar a Configuración, cambio de
          contraseña y el resto de las opciones.
        </p>
        <Captura src="14-menu-mas.jpg" alt="Menú Más" />
        <p>
          En <strong>Equipo</strong> sumás a quien trabaje con vos (cajeros, por ejemplo) — le mandás un
          link por WhatsApp y esa persona entra con su propia cuenta.
        </p>
        <Captura src="15-admin-equipo.jpg" alt="Equipo" />
        <p>
          En <strong>Medios de cobro</strong> configurás la comisión y el plazo de acreditación de cada
          medio (efectivo, tarjetas, transferencia, QR). Un cambio acá rige de ahí en adelante — los cobros
          ya hechos conservan los valores con los que se hicieron.
        </p>
        <Captura src="16-admin-medios-cobro.jpg" alt="Medios de cobro" />
      </Seccion>

      <Seccion titulo="8. Preguntas frecuentes">
        <p><strong>Cargué mal un cobro, ¿cómo lo saco?</strong><br />
          Nada se borra. Anulalo y se crea una reversa: el original queda tachado en la caja, pero visible,
          y ninguno de los dos suma al total.</p>
        <p><strong>¿La caja se cierra sola a la medianoche?</strong><br />
          No, el día de la app sigue hasta que vos cerrás la caja, aunque sean pasadas las 21:00.</p>
        <p><strong>Cambié la comisión de un medio de pago, ¿se actualizan los cobros viejos?</strong><br />
          No. Cada cobro guarda su comisión, IVA y fecha de acreditación del momento en que se hizo.</p>
        <p><strong>¿Quién puede ver Administración?</strong><br />
          Solo el dueño. Un cajero opera la caja pero no ve esa sección.</p>
        <p><strong>¿Qué hago si algo no funciona como acá?</strong><br />
          Escribinos a supportfranquicias@gmail.com.</p>
      </Seccion>
    </div>
  )
}

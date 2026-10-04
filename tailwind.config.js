/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    // lib/ui/estilos.js arma nombres de clase (bg-primary-500, etc.) como
    // string — sin escanear esta carpeta, Tailwind nunca los ve y los purga.
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta semántica chica: los mismos tonos que ya se usaban sueltos
        // por toda la app (blue/green/red/amber de Tailwind), con un nombre
        // por intención en vez de por color — primary=navegación/acción
        // neutral, success=positivo/confirmar, danger=negativo/destructivo,
        // warning=atención. No son colores nuevos, es consolidar los que
        // ya existían bajo un solo nombre cada uno.
        // 800 solo hace falta para el hover de success (ver lib/ui/estilos.js:
        // success-500/600 con texto blanco no llega a WCAG AA, success-700 sí).
        // Rediseño visual: primary pasa a ser el verde de marca (antes azul).
        primary: { 50: '#e6f7f1', 500: '#019c62', 600: '#01825c', 700: '#016b4b' },
        // Fondo base cálido: el blanco puro se sentía frío.
        fondo: '#FAF9F6',
        success: { 50: '#f0fdf4', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534' },
        danger: { 50: '#fef2f2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
        warning: { 50: '#fffbeb', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
      },
      boxShadow: {
        suave: '0 1px 2px rgba(20, 20, 15, 0.04), 0 4px 16px rgba(20, 20, 15, 0.06)',
      },
      // Ease-out fuerte (emil): arranca rápido, frena suave. Nunca desde scale(0).
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms cubic-bezier(0.23, 1, 0.32, 1)',
        'sheet-in': 'sheet-in 260ms cubic-bezier(0.23, 1, 0.32, 1)',
        'pop-in': 'pop-in 160ms cubic-bezier(0.23, 1, 0.32, 1)',
      },
    },
  },
  plugins: [],
}
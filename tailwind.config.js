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
        primary: { 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
        success: { 50: '#f0fdf4', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534' },
        danger: { 50: '#fef2f2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
        warning: { 50: '#fffbeb', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
      },
    },
  },
  plugins: [],
}
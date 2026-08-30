import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        // Una sola familia (Inter Variable) para todo el sitio. Los tokens se conservan
        // porque el resto del código sigue usando font-sans/serif/mono/headline como
        // roles semánticos, no como familias distintas.
        sans: ['"Inter Variable"', 'sans-serif'],
        serif: ['"Inter Variable"', 'sans-serif'],
        mono: ['"Inter Variable"', 'sans-serif'],
        headline: ['"Inter Variable"', 'sans-serif'],
      },
      colors: {
        // Paleta invertida (dark) adaptada de la referencia de diseño Riptype Foundry —
        // los nombres de rol se conservan (canvas/ink/etc. ya eran roles semánticos, no
        // colores literales) así que un cambio de paleta no obliga a tocar cada
        // componente, solo estos valores.
        canvas: '#121212', // fondo base de página (Workshop Black)
        surface: '#292929', // superficie elevada: cards, modal, barras de nav (Platen Gray)
        ink: '#ffffff', // texto/foreground principal (Paper White)
        'ink-muted': '#a0a0a0', // texto secundario, metadata (Ash)
        bone: '#d0d0d0', // cuerpo de texto largo en prosa/artículos (Bone)
        accent: '#d9ff00', // único color de señal — CTAs, tags, bordes activos (Acid Flash)
      },
    },
  },
  plugins: [typography],
};

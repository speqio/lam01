import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        // Una sola familia (Lekton, monoespaciada) para todo el sitio. Los tokens se
        // conservan porque el resto del código sigue usando font-sans/serif/mono/headline
        // como roles semánticos, no como familias distintas. Fallback "monospace" (no
        // "sans-serif") para que, si Lekton no llega a cargar, el navegador elija un
        // sustituto con métricas parecidas en vez de uno proporcional.
        sans: ['Lekton', 'monospace'],
        serif: ['Lekton', 'monospace'],
        mono: ['Lekton', 'monospace'],
        headline: ['Lekton', 'monospace'],
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
        accent: '#a6294a', // único color de señal — CTAs, tags, bordes activos (Burdeo)
      },
    },
  },
  plugins: [typography],
};

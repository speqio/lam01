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
        // Los tokens ya no son colores fijos: cada uno lee una variable CSS (definida en
        // global.css para :root y para :root[data-theme='light']) para poder alternar
        // entre modo oscuro y claro sin tocar ninguna clase Tailwind del sitio — los
        // componentes siguen usando bg-canvas/text-ink/etc. como siempre, el valor real
        // detrás cambia según el atributo data-theme en <html>. El patrón
        // "rgb(var(--x) / <alpha-value>)" conserva los modificadores de opacidad
        // (ink/60, surface/95, etc.) que ya se usan en todo el código.
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        'ink-muted': 'rgb(var(--color-ink-muted) / <alpha-value>)',
        bone: 'rgb(var(--color-bone) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
      },
    },
  },
  plugins: [typography],
};

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
      spacing: {
        // Regla global de espaciado responsivo: Header.astro es un masthead FIJO
        // (no empuja el contenido, flota encima — `fixed inset-x-0 top-0`, alto
        // h-20/5rem, se contrae a 3.5rem al scrollear) y solo aparece en md+
        // (`hidden md:block`; en mobile la nav vive
        // abajo, MobileFloatingNav.astro). Cualquier bloque que empiece con texto
        // cerca del techo de la página (típicamente un PageHeader.astro) necesita
        // este mismo despeje SOLO en md+ para no quedar tapado/pegado al masthead —
        // en mobile no hace falta, ahí no hay header flotante. Un solo valor acá
        // (5rem de alto + ~4rem de aire) en vez de repetir el cálculo a mano en cada
        // página; usar como `md:mt-header-clear` (o `md:pt-header-clear`), nunca en
        // mobile.
        // Cálculo: <main> ya aporta py-8 (2rem) arriba, así que 2rem + 4.5rem = 6.5rem desde
        // el borde superior, contra una barra de 5rem: ~1.5rem de aire libre. Antes era 9rem
        // y en desktop dejaba ~6rem vacíos debajo del header, que se traducían en scroll.
        'header-clear': '4.5rem',
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

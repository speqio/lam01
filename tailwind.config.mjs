import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        // Una sola familia (IM Fell DW Pica — la del banner animado del hero) para todo
        // el sitio. Los tokens se conservan porque el resto del código sigue usando
        // font-sans/serif/mono/headline como roles semánticos, no como familias distintas.
        sans: ['"IM Fell DW Pica"', 'serif'],
        serif: ['"IM Fell DW Pica"', 'serif'],
        mono: ['"IM Fell DW Pica"', 'serif'],
        headline: ['"IM Fell DW Pica"', 'serif'],
      },
      colors: {
        paper: '#FFFFF0',
        ink: '#000000',
        'ink-muted': '#4A4340',
        linen: '#E6DFC8',
        accent: '#701F0F',
        'accent-amber': '#B0600B',
      },
    },
  },
  plugins: [typography],
};

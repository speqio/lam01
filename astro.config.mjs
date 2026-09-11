import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import markdoc from '@astrojs/markdoc';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare(),
  integrations: [react(), keystatic(), markdoc()],
  vite: {
    optimizeDeps: {
      // El panel de Keystatic importa react-dom/client de forma dinámica; Vite no lo
      // detecta al escanear dependencias y lo sirve sin transformar (CJS crudo) si no
      // se fuerza aquí, rompiendo la hidratación con "does not provide an export named 'createRoot'".
      include: ['react-dom/client', 'react/jsx-runtime'],
    },
  },
});

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
      // Sin esto `astro dev` no arranca. La integración de Keystatic añade
      // `.astro/keystatic-imports.js` a optimizeDeps.entries, ese archivo importa
      // @keystatic/astro/api, y este importa el módulo virtual 'virtual:keystatic-config',
      // que solo existe gracias al resolveId del plugin de Keystatic. El optimizador de
      // dependencias no pasa por ese hook, así que aborta con "Could not resolve
      // virtual:keystatic-config" y el servidor muere antes de estar listo. `astro build`
      // no usa el optimizador, por eso compila sin problema y el fallo solo se ve en dev.
      exclude: ['virtual:keystatic-config'],
    },
  },
});

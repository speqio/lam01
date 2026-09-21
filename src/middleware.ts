import { defineMiddleware } from 'astro:middleware';

/**
 * La ruta /keystatic la inyecta la integración @keystatic/astro (ver
 * node_modules/@keystatic/astro/internal/keystatic-astro-page.astro) y renderiza un
 * documento sin <head> en absoluto: sin <title>, sin favicon. No hay forma de
 * personalizar eso desde keystatic.config.ts/astro.config.mjs, así que se inyecta acá,
 * a nivel de respuesta HTTP, un <head> mínimo con el título de la pestaña y un favicon
 * propio (azul, para distinguir el panel admin del sitio público) antes de que el HTML
 * llegue al navegador.
 */
// Rama donde el cliente guarda desde Keystatic (ver docs/flujo-keystatic.md). Keystatic, sin
// más, abre la rama predeterminada del repo (`main`); así que la entrada al panel se manda
// acá. `main` queda protegida en GitHub: allí solo llega contenido por pull request.
const RAMA_KEYSTATIC = 'keystatic';

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname === '/keystatic' || context.url.pathname === '/keystatic/') {
    return context.redirect(`/keystatic/branch/${RAMA_KEYSTATIC}`, 302);
  }

  const response = await next();

  if (!context.url.pathname.startsWith('/keystatic')) return response;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  if (html.includes('<title>')) return response;

  const head =
    '<head><meta charset="UTF-8" /><title>Admin — La Antorcha Magacín</title>' +
    '<link rel="icon" type="image/svg+xml" href="/favicon-admin.svg" /></head>';

  const withHead = html.includes('<!DOCTYPE html>')
    ? html.replace('<!DOCTYPE html>', `<!DOCTYPE html>${head}`)
    : `${head}${html}`;

  return new Response(withHead, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
});

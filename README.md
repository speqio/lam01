# La Antorcha Magacín

Sitio del magacín literario *La Antorcha Magacín* — un blog de contenido estático (entradas,
números, autores, categorías) con un CMS integrado para que la redacción edite sin tocar
código.

## Stack

- **[Astro 7](https://astro.build)** (salida híbrida vía `@astrojs/cloudflare`), con casi
  todas las rutas renderizadas 100% estáticas (`getStaticPaths()`).
- **React 18** solo para un puñado de piezas interactivas (buscador, alguna isla puntual).
- **[Keystatic](https://keystatic.com)** en modo GitHub como CMS — admin en `/keystatic`,
  cada guardado es un commit a la rama `keystatic` vía una GitHub App.
- **Markdoc** para el cuerpo de las entradas, **Tailwind CSS 3** para estilos, **GSAP** como
  única librería de animación.
- Desplegado en **Cloudflare Workers** (Workers Builds, auto-deploy desde `main`).

## Desarrollo local

```bash
npm install
npm run dev        # astro dev — http://localhost:4321 (o el puerto que imprima)
```

`/keystatic` corre en ese mismo servidor de desarrollo, no hace falta nada aparte para
probar el CMS localmente.

Otros comandos útiles:

```bash
npm run build       # build de producción
npm run preview     # sirve el build de dist/ localmente
npm run cf:preview  # wrangler dev — corre el build contra el runtime real de Cloudflare
```

## Contenido y CMS

Cuatro colecciones (`autores`, `categorias`, `numeros`, `entradas`) definidas en
`src/content.config.ts` (esquema Zod) y `keystatic.config.ts` (UI de edición) — los dos
archivos tienen que mantenerse sincronizados.

El flujo de contenido está separado del flujo de código:

- **Código** → directo a `main` (`git push origin main`), Cloudflare Workers Builds
  despliega automáticamente.
- **Contenido** (lo que la redacción guarda desde `/keystatic`) → va a la rama `keystatic`,
  y llega a producción por un pull request `keystatic → main` (chequeo automático
  `verificar` en GitHub Actions).

Antes de cualquier push de código a `main`:

```bash
git pull
npm run build
node scripts/verificar-keystatic.mjs
```

## Documentación

Este README es la puerta de entrada rápida. El detalle operativo — convenciones de
imágenes, gotchas de Keystatic, por qué está armado así cada componente interactivo,
decisiones de la migración de hosting, etc. — vive en [`CLAUDE.md`](./CLAUDE.md) y en
[`docs/`](./docs), pensados tanto para quien retoma el proyecto como para los asistentes
de código que trabajan sobre él.

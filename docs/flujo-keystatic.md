# Flujo de trabajo: rama `keystatic` (contenido) y `main` (código)

Reemplaza a `pendiente-rama-keystatic.md`.

## Idea
- El **cliente** guarda desde `/keystatic`. Cada guardado es un commit a la rama **`keystatic`** (la entrada `/keystatic` redirige sola a `/keystatic/branch/keystatic`, ver `src/middleware.ts`).
- El **código** (Astro, componentes, scripts) va a **`main`**.
- El contenido pasa de `keystatic` a `main` por **pull request**, con la comprobación automática `verificar` en verde, y se fusiona con **squash**. Cloudflare publica `main`.

## Configuración única en GitHub (solo el dueño, Settings del repo `speqio/lam01`)
1. **Rulesets → New branch ruleset**, apuntando a `main`: exigir pull request, exigir el check `verificar`, bloquear force-push, con el dueño en la lista de **bypass** (para seguir empujando código directo). **No** proteger `keystatic`.
2. **General → Pull Requests**: dejar solo *Allow squash merging*; desactivar *Automatically delete head branches* (no debe borrarse `keystatic`).
3. **Cloudflare → Worker → Builds**: la rama de producción es `main`.

## Ciclo normal de contenido
1. El cliente edita y guarda en Keystatic (rama `keystatic`). Un guardado = un ítem, luego recargar (recargar la página (F5; Ctrl+Shift+R solo si persiste)) — ver CLAUDE.md.
2. El cliente avisa (por fuera) que terminó.
3. El dueño abre el PR `keystatic` → `main` en GitHub y espera el check `verificar`:
   - ✅ → revisa el diff → **Squash and merge** → Cloudflare publica.
   - ❌ → no se fusiona; se ve el error en el check (build roto o referencia de imagen rota), se corrige en la rama y se repite.
4. Después de fusionar: `node scripts/keystatic-sync.mjs cerrar-ciclo`. Deja `keystatic` igual a `main`. Se niega si el cliente guardó algo nuevo sin fusionar. Avisar al cliente que **recargue Keystatic**.

## Cuando se publica código mientras el cliente edita
- Código a `main` (push directo, con bypass).
- `node scripts/keystatic-sync.mjs traer-main` (merge de `main` en `keystatic`, sin riesgo) para que `verificar` corra con el código actual.
- Regla: **no tocar `src/content` ni `public/images` en `main`** mientras haya un ciclo abierto; si hay que hacerlo (correcciones masivas), coordinar con el cliente y hacerlo con el ciclo cerrado.

## Deshacer un cambio malo ya publicado
1. `git revert <commit del squash en main>` → push a `main` (Cloudflare vuelve a publicar la versión anterior).
2. `node scripts/keystatic-sync.mjs cerrar-ciclo` para alinear `keystatic`. Si el contenido revertido debe rehacerse, el cliente lo vuelve a guardar en la rama.
- Nada se pierde: todo guardado queda en el historial de git.

## Limitaciones a tener presentes
- La rama **no arregla** el error de borrado de Keystatic (`A path was requested for deletion…`): sigue valiendo "un ítem, un guardado, recargar".
- `verificar` detecta build roto, campos obligatorios vacíos, imágenes inexistentes y slugs que chocan con páginas fijas (el build falla). No detecta errores de contenido/estilo.
- El check corre en GitHub; no hay vista previa del sitio de la rama (posible mejora: builds de ramas no productivas en Cloudflare).

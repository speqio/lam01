# Keystatic: fallos propios de la librería, cómo reportarlos y qué hacer mientras

Estado: 10-oct-2026 · `@keystatic/core@0.6.9` · `@keystatic/astro@6.0.0` · modo `github`

Este documento reúne cuatro fallos que **no son de este proyecto** sino de Keystatic, con la
evidencia necesaria para reportarlos, y evalúa las salidas posibles (parche local, migración
de campo, fork, soporte). Complementa `docs/flujo-keystatic.md`, que describe el flujo de
ramas, y `CLAUDE.md`, que recoge las reglas de convivencia con la herramienta.

Todo lo que sigue se verificó leyendo `node_modules/@keystatic/core/dist/` y reproduciendo
los casos localmente. Lo que es deducción y no prueba está marcado como tal.

---

## 1. Panorama: no hay versión a la que subir

- `0.6.9` (26-ago-2026) es **la última publicada en npm**. No hay actualización pendiente.
- El repositorio está vivo pero delgado: último push 01-oct-2026, **196 issues abiertos**,
  y en la práctica un solo mantenedor activo (`emmatown`) más PRs sueltas de la comunidad.
  Los commits de sept/oct son menores (traducciones, config de wrangler).
- Hay issues de septiembre-2026 sobre justamente esta familia de problemas **con cero
  comentarios**. La probabilidad de un arreglo rápido upstream es baja.
- MIT, 2.4k estrellas, 167 forks. Sin oferta de soporte comercial publicada (ver §7).

---

## 2. Fallo A — en modo GitHub, Keystatic no actualiza su puntero tras guardar

**Síntoma para el editor:** hay que recargar `/keystatic` entre guardados. Si no, el
siguiente guardado falla con *"This entry has been updated since it was opened. Create a new
branch to save changes."* o con *"A path was requested for deletion which does not exist"*.

**Causa exacta.** En `useUpsertItem` (en el bundle:
`node_modules/@keystatic/core/dist/keystatic-core-ui.js`, ~offset 64400-71900; en el
repositorio: `packages/keystatic/src/app/updating.tsx`) hay dos caminos de guardado, y solo
uno refresca el estado:

```js
// modo local-storage (~@71806 y ~@75547)        // modo github / cloud (~@70300)
const { tree } = await hydrateTreeCacheWithEntries(newTree);   // (nada)
setTreeSha(await treeSha(tree));                               setState({ kind: 'updated' });
setState({ kind: 'updated' });                                 return true;
```

`setTreeSha` **solo se llama en el camino local**. En modo GitHub, tras commitear con éxito,
la aplicación sigue apuntando al commit anterior. Queda congelado todo lo que se capturó al
abrir la entrada:

| Valor | Para qué se usa | Consecuencia de que no se refresque |
|---|---|---|
| `baseCommit` | va como `expectedHeadOid` en la mutación | GitHub responde `STALE_DATA` |
| `args.initialFiles` | `deletions = initialFiles − additions` | se reenvían borrados ya aplicados |
| `args.currentLocalTreeKey` | compuerta del reintento automático | el reintento se niega |

Keystatic **sí** tiene un camino de recuperación: ante `STALE_DATA` vuelve a pedir la cabeza
de la rama, recalcula la clave de árbol de la entrada y reintenta solo si coincide. Pero la
clave que compara es la vieja, de antes del guardado, así que al volver a guardar **la misma**
entrada nunca coincide.

**Detalle que permite relajar la regla operativa.** La clave de árbol es **por entrada**, no
por colección (`getDirectoriesForTreeKey`, en `dist/index-5d64e651.js`):

```js
function getDirectoriesForTreeKey(schema, directory, slug, format) {
  const directories = [fixPath(directory)];                       // src/content/entradas/<slug>
  if (format.dataLocation === 'outer')
    directories.push(fixPath(directory) + getDataFileExtension(format));  // ...<slug>.mdoc
  for (const d of collectDirectoriesUsedInSchema(schema))
    directories.push(d + (slug === undefined ? '' : `/${slug}`));  // public/images/entradas/<slug>
  return directories;
}
```

Con `path: 'src/content/entradas/*'`, guardar la entrada A no toca ninguna ruta de la entrada
B. De ahí se deduce que **guardar entradas distintas una tras otra debería funcionar sin
recargar** (el reintento automático se encarga, a costa de un viaje extra), y que solo hace
falta recargar antes de **volver a guardar la misma entrada**. Deducido del código, **no
probado contra GitHub todavía**: conviene validarlo con dos guardados reales antes de
cambiarle las instrucciones al cliente.

**Arreglo upstream propuesto:** en el camino github/cloud, aprovechar el árbol que la función
*ya* calcula y descarta, y hacer lo mismo que el camino local:

```js
const updatedTree = await updateTreeWithChanges(unscopedTree, { additions, deletions: [...filesToDelete] });
const { tree } = await hydrateTreeCacheWithEntries(updatedTree.entries);   // hoy se ignora el retorno
// ...tras el commit exitoso:
setTreeSha(await treeSha(tree));                                          // ← la línea que falta
setState({ kind: 'updated' });
```

**Issue vecino, abierto y sin respuesta:**
[#1626](https://github.com/Thinkmill/keystatic/issues/1626) (23-sep-2026) describe el mismo
`useUpsertItem` pero en el camino de **creación** (`currentLocalTreeKey` indefinido). Nuestro
caso es el hermano del camino de **edición**. Conviene mencionarlo al reportar: comparten
función y probablemente arreglo.

Otros relacionados, también abiertos: [#1627](https://github.com/Thinkmill/keystatic/issues/1627),
[#1617](https://github.com/Thinkmill/keystatic/issues/1617). Cerrado sin arreglo:
[#1269](https://github.com/Thinkmill/keystatic/issues/1269).

---

## 3. Fallo B — el editor pierde los escapes de Markdown y deja la entrada irrecuperable

Este es el que nos reventó `las-trampas-de-virgilio` y puso rojo el Action.

**Lo primero, porque es contraintuitivo:** la forma **escapada** es perfectamente válida y
Keystatic la abre sin problema. Comprobado con el propio Markdoc que trae la librería:

```
"texto\![\[6\]](#_ftn6)"   ->  document paragraph inline text link text    ← sano
"texto![[6]](#_ftn6)"      ->  document paragraph inline text image        ← rompe
"texto! [[6]](#_ftn6)"     ->  document paragraph inline text link text    ← sano
```

**La secuencia del fallo:**

1. Una entrada migrada de WordPress trae llamadas de nota al pie escapadas:
   `...democracia\![\[6\]](#_ftn6)`. Markdown lee eso como texto + enlace. Todo bien.
2. El editor abre la entrada, el cliente guarda **cualquier cosa** (en nuestro caso, subir
   una portada), y Keystatic **reescribe el archivo entero** al serializar de vuelta. En esa
   ida y vuelta **se pierden los backslashes**: `[\[6\]]` queda como `[[6]]`.
3. Ahora `...democracia![[6]](#_ftn6)` es una **imagen en línea** sin ambigüedad.
4. `inlineFromMarkdoc` no contempla el tipo `image` y lanza
   `Unknown inline node type: image` (en `dist/index-3c244051.js` y gemelos; en el
   repositorio, `from-markdoc.ts`). La entrada **ya no se puede abrir en el CMS**, y el
   lector (`createReader`) falla igual, así que el build y el CI también caen.

Es decir: **Keystatic convierte, por sí solo, contenido válido en contenido que ya no puede
leer.** No hace falta que el editor escriba nada raro.

**Evidencia real, no sintética.** El commit `7b923c4` de este repositorio es el guardado del
cliente; su diff muestra la pérdida de escapes en todo el archivo:

```diff
-Virgilio Piñera[\[1\]](…#_ftn1)
+Virgilio Piñera[[1]](…#_ftn1)
-...tetas, tetaaaas\![\[19\]](#_ftn19)
+...tetas, tetaaaas![[19]](#_ftn19)      ← este es el que rompe
```

De paso normaliza `_cursiva_` a `*cursiva*`, que es inocuo.

**Postura del mantenedor.** Hay tres issues cerrados por este error —
[#752](https://github.com/Thinkmill/keystatic/issues/752),
[#609](https://github.com/Thinkmill/keystatic/issues/609),
[#520](https://github.com/Thinkmill/keystatic/issues/520) — y en el último comentario de #752
(`emmatown`, dic-2024) el mantenedor dice que esta familia de fallos de **`fields.document`**
está resuelta usando **`fields.markdoc`** o **`fields.mdx`**, y que el arreglo es cambiar de
campo, no reparar `fields.document`.

**Este proyecto usa `fields.document`** (`keystatic.config.ts:206`). Eso abre una salida que
no habíamos considerado: ver §6, opción C.

Ojo: aunque ese sea el camino recomendado, el reporte sigue valiendo. "Perder los escapes al
reserializar y dejar la entrada ilegible" no es lo mismo que "no se admiten imágenes en
línea", y un `fields.document` que corrompe su propio contenido merece al menos un aviso en
la documentación mientras siga siendo la opción por defecto en los ejemplos.

---

## 4. Fallo C — una imagen que falta vacía el campo y además bloquea el guardado

Ya está descrito en `CLAUDE.md`; se resume aquí porque forma parte del mismo reporte.

Si un archivo de imagen referenciado no existe en el repositorio, Keystatic lee el campo como
**vacío** y lo guarda vacío (se pierde la referencia: `- {}` en una galería, "Missing image"
en el cuerpo). Y como la ruta sí estaba en `initialFiles` y ya no está en `additions`, entra
en `deletions`, y GitHub rechaza **todo** el commit con *"A path was requested for deletion
which does not exist"*. Un archivo faltante pasa así de ser un hueco visual a impedir
cualquier guardado de ese ítem.

Upstream hay casos muy cercanos abiertos y sin respuesta:
[#1625](https://github.com/Thinkmill/keystatic/issues/1625) (una URL externa tratada como
asset local corrompe el cuerpo al guardar y produce el mismo error de borrado),
[#1627](https://github.com/Thinkmill/keystatic/issues/1627), [#1617](https://github.com/Thinkmill/keystatic/issues/1617).

Mitigación local ya implementada: `scripts/imagenes-pendientes.mjs`,
`scripts/portadas-provisionales.mjs` y el paso 2 de `scripts/verificar-keystatic.mjs`.

`fields.markdoc` **no** tiene este problema: conserva la referencia aunque falte el archivo
(ver la tabla de la opción C en §6). Es el segundo argumento a favor de migrar.

---

## 4 bis. Fallo D — un divisor al principio del cuerpo: dos guardados destruyen la entrada

**El más grave de los cuatro, y el único que destruye contenido sin avisar.** Descubierto el
10-oct-2026 midiendo la opción C. Afecta a **20 entradas** de este repositorio ahora mismo.

**La cadena:**

1. Veinte cuerpos, migrados de WordPress, empiezan con un divisor: `* * *`.
2. Al guardar, Keystatic normaliza cualquier divisor a `---`. Como era lo primero del cuerpo,
   el cuerpo queda **empezando por `---`**.
3. La página publicada sigue bien, porque ahí Markdoc ve delante el frontmatter YAML del
   archivo y lee ese `---` como un divisor normal. **El build no falla. El CI no se entera.**
4. Pero Keystatic pasa al campo **solo el cuerpo**, sin el frontmatter. Entonces ese `---`
   inicial está en la posición 0, y Markdoc lo lee como **el principio de un bloque de
   frontmatter**: se traga todo hasta el siguiente `---`.
5. El editor muestra la entrada mutilada, y el siguiente guardado **escribe la mutilación en
   el repositorio**. Ahí sí se pierde en la web.

**Medido** (`alfredo-soto-guillen`, cuerpo en bytes):

```
original 2133  ->  1er guardado 2122  ->  2do guardado 310
```

De 2133 bytes quedan 310: sobrevive el párrafo de la biografía, desaparece el poema completo.
Lo mismo en las otras 19, entre el 74% y el 96% del cuerpo. Idéntico con `fields.document` y
con `fields.markdoc`, así que la opción C no protege de esto.

Agrava el asunto que la regla operativa vigente ("un ítem, un guardado, y recargar") **no
protege**: el guardado peligroso es justo el segundo, después de recargar.

**Detección local:** paso 4 de `scripts/verificar-keystatic.mjs` (rama `prueba-markdoc`),
que marca todo cuerpo cuya primera línea no vacía sea un divisor.

**Arreglo local:** quitar el divisor inicial de esas 20 entradas. Es decorativo y además
sobra: hoy renderiza un `<hr>` como primer elemento de la entrada, que casi seguro no era la
intención de nadie. Hay que hacerlo **por la rama `keystatic`** (es contenido) y aterrizar el
paso 4 en el mismo ciclo, porque mientras las 20 sigan ahí el check deja el CI en rojo.

**Cuerpo para reportarlo (issue nuevo):**

> **Title:** A thematic break at the start of a content field's body is serialized as `---`, and the next save silently deletes the entry's content
>
> **Version:** `@keystatic/core@0.6.9`; happens with both `fields.document` and `fields.markdoc`, `.mdoc` files with YAML frontmatter
>
> **What happens**
>
> If an entry's body starts with a thematic break written as `* * *` (ours came from a
> WordPress import), saving the entry normalizes it to `---`. The body now *begins* with
> `---`. Because the field is handed the body without the frontmatter block, Markdoc parses
> that leading `---` as the start of a frontmatter block and swallows everything up to the
> next `---`. The editor then shows the entry nearly empty, and the next save writes that
> truncation to the repository.
>
> Measured on one of our entries, body size in bytes:
> `2133 (original) -> 2122 (after first save) -> 310 (after second save)`. The 1800 characters
> in between are a poem, and they are simply gone.
>
> The published site survives the *first* save, because there Markdoc sees the YAML
> frontmatter first and reads the `---` as an ordinary divider — so the build stays green and
> nothing warns the editor. The loss only becomes visible after the second save.
>
> **Steps to reproduce**
>
> 1. Create an entry whose body starts with `* * *` followed by some paragraphs.
> 2. Save it from the admin UI. The file is still complete, but the body now starts with `---`.
> 3. Reload and open the same entry: the editor shows only whatever came after the *second*
>    `---` in the body.
> 4. Save again. The content is now gone from the file.
>
> **Suggested fix**
>
> Either serialize a leading thematic break as something unambiguous (`* * *`, or `---`
> preceded by a blank line is not enough — the problem is being at offset 0), or have the
> field's parse step not treat a leading `---` in a *body* as frontmatter, since the body it
> receives has already had its frontmatter stripped by the caller.

---

## 5. Cómo reportarlo

Upstream se trabaja en inglés. Abajo van los cuerpos listos para pegar.

**Dónde:**
1. **Fallo A** → comentario en [#1626](https://github.com/Thinkmill/keystatic/issues/1626)
   *más* issue propio. El issue existente es del camino de creación y el reportante ya tiene
   diagnóstico; sumar ahí el hermano del camino de edición le da peso a los dos y evita que
   se arregle solo la mitad.
2. **Fallo B** → issue nuevo. No reabrir #752: está cerrado con una respuesta de diseño
   ("usa `fields.markdoc`"). El ángulo nuevo es la **pérdida de escapes en la ida y vuelta**,
   que ninguno de los tres issues cerrados plantea.
3. **Fallo C** → comentario en [#1625](https://github.com/Thinkmill/keystatic/issues/1625),
   que es casi idéntico, en vez de un issue duplicado.
4. **Fallo D** → issue nuevo (cuerpo en §4 bis). Es el más grave y no hay nada parecido
   abierto; va primero si solo se va a reportar uno.

**Formulario:** https://github.com/Thinkmill/keystatic/issues/new/choose
**Discusiones:** https://github.com/Thinkmill/keystatic/discussions
**Discord:** https://keystatic.com/chat — para el fallo A conviene avisar también por aquí,
porque es el que afecta a cualquiera que use modo GitHub y tiene un arreglo de una línea.

Al reportar, hacerlo desde una cuenta propia y sin pegar nada sensible: los nombres de rama y
las rutas de `src/content` son inocuos, pero no hace falta incluir el nombre del repositorio
privado ni correos del cliente.

### 5.1 Cuerpo para el fallo A (issue nuevo)

> **Title:** GitHub mode never updates the tree sha after a successful commit, so a second save of the same entry always fails
>
> **Version:** `@keystatic/core@0.6.9`, `@keystatic/astro@6.0.0`, `storage: { kind: 'github' }`
>
> **What happens**
>
> After saving an entry successfully, saving that *same* entry again without a full page
> reload fails with *"This entry has been updated since it was opened. Create a new branch to
> save changes."* — or, when the first save removed a file, with GitHub's *"A path was
> requested for deletion which does not exist"*. Reloading the page always fixes it, so our
> editors have been told to press F5 after every save.
>
> **Steps to reproduce**
>
> 1. Configure `storage: { kind: 'github' }` and open an existing entry in `/keystatic`.
> 2. Change a field and save. The commit lands correctly.
> 3. Without reloading, change another field in the same entry and save again. It fails.
> 4. Reload the page and repeat step 3. It succeeds.
>
> **Cause**
>
> In `useUpsertItem`, the local-storage path calls `setTreeSha(...)` after a successful write,
> but the github/cloud path does not — it only does `setState({ kind: 'updated' })`. So
> `baseCommit`, `args.initialFiles` and `args.currentLocalTreeKey` all keep pointing at the
> commit the entry was opened on.
>
> That breaks three things at once on the next save of the same entry:
>
> - `expectedHeadOid` is the stale commit, so GitHub returns `STALE_DATA`;
> - the `STALE_DATA` recovery path refetches the head and compares the entry's tree key
>   against `args.currentLocalTreeKey`, which is pre-save, so the keys never match and it
>   bails out to `needs-new-branch` instead of retrying;
> - `deletions` is recomputed from the stale `initialFiles`, so any file the first save
>   removed is listed for deletion again, and GitHub rejects the whole commit.
>
> Saving a *different* entry works, because the tree key is per entry
> (`getDirectoriesForTreeKey`) and the retry gate passes.
>
> **Suggested fix**
>
> The github path already computes the post-save tree and throws the result away:
>
> ```js
> const updatedTree = await updateTreeWithChanges(unscopedTree, { additions, deletions: [...filesToDelete] });
> await hydrateTreeCacheWithEntries(updatedTree.entries);   // return value ignored
> ```
>
> Keeping it and calling `setTreeSha(await treeSha(tree))` after the commit succeeds — exactly
> what the local path does — should be enough.
>
> **Related:** #1626 is the same function on the *create* path (`currentLocalTreeKey` is
> `undefined` there). Likely the same fix area.

### 5.2 Cuerpo para el fallo B (issue nuevo)

> **Title:** `fields.document` drops backslash escapes when re-serializing, which can make the entry permanently unopenable ("Unknown inline node type: image")
>
> **Version:** `@keystatic/core@0.6.9`, `fields.document` with `format: { contentField: ... }` (`.mdoc`)
>
> **What happens**
>
> Saving an entry rewrites the whole body, and the round trip loses Markdown backslash
> escapes. When the escaped text is a `\!` immediately followed by a link — common in content
> migrated from WordPress, where footnote markers look like
> `...democracia\![\[6\]](#_ftn6)` — the re-serialized file contains `![[6]](#_ftn6)`, which
> is an inline image. From then on the entry cannot be opened at all:
> `Field validation failed: contenido: Unexpected error: Error: Unknown inline node type: image`
> thrown from `inlineFromMarkdoc`. `createReader()` fails on the same file, so the site build
> and CI break too.
>
> The content was valid before the save, and the editor saved it without the user touching
> that paragraph — in our case the user only uploaded a cover image.
>
> **Reproduce**
>
> Markdoc parses the two forms differently, so the escape is load-bearing:
>
> ```
> "text\![\[6\]](#_ftn6)"   ->  text link text    (fine, opens in the editor)
> "text![[6]](#_ftn6)"      ->  text image        (throws on open)
> ```
>
> 1. Put `text\![\[6\]](#_ftn6)` in the body of an entry. It opens fine.
> 2. Open it in `/keystatic`, change any other field, save.
> 3. The file on disk now reads `text![[6]](#_ftn6)`.
> 4. Reload and open the entry: it throws, and nothing in the UI can repair it — the fix has
>    to be made outside the CMS.
>
> Real-world diff from one of our saves, where every footnote marker lost its escape:
>
> ```diff
> -Virgilio Piñera[\[1\]](…#_ftn1)
> +Virgilio Piñera[[1]](…#_ftn1)
> -...tetas, tetaaaas\![\[19\]](#_ftn19)
> +...tetas, tetaaaas![[19]](#_ftn19)
> ```
>
> **Why this isn't #752 / #609 / #520**
>
> Those are about authoring inline images and are closed with "use `fields.markdoc` /
> `fields.mdx`". This report is narrower and, I think, worse: `fields.document` turns content
> it could read into content it cannot read, with no user action on the affected text. Even if
> `fields.document` is not going to be fixed, two things would help a lot:
>
> 1. preserve backslash escapes on serialization (or re-escape a `!` that would otherwise
>    start an image); and/or
> 2. make `inlineFromMarkdoc` degrade gracefully for `image` instead of throwing, so one
>    inline image doesn't make the whole entry unreachable;
> 3. and in any case, say in the docs that `fields.document` should not be used for imported
>    Markdown, since one save can corrupt it.

---

## 6. Qué podemos hacer nosotros, en orden de menor a mayor riesgo

### Opción 0 — relajar la regla operativa (coste cero)

Si se confirma lo deducido en §2, el mensaje al cliente pasa de "recargá después de cada
guardado" a **"recargá solo si vas a volver a guardar la misma entrada"**. No toca código.
Hay que validarlo primero con dos guardados reales seguidos en la rama `keystatic`.

### Opción A — recarga automática tras guardar — **IMPLEMENTADA** (10-oct-2026)

Está en `src/lib/adminReload.ts`, inyectada por `src/middleware.ts`, y **funcionando en
producción**: tras cada guardado exitoso sale un aviso a pantalla completa y el panel se
recarga solo. Lo que sigue describe el diseño; al final, las tres suposiciones que hubo que
descartar, que es la parte útil si alguien toca la detección.

**Lo que cuesta saber y nadie documenta.** La detección del guardado se hizo tres veces mal
antes de acertar, y cada corrección salió de un dato real del modo registro en producción:

| Intento | Suposición | Lo que pasa de verdad |
|---|---|---|
| v1 | leer la respuesta dirá si el commit salió bien | **`res.clone()` se rechaza**: urql aborta la petición en su *teardown* y eso cancela la rama clonada del cuerpo antes de terminar de leerla. El cuerpo de la respuesta es ilegible desde un envoltorio de `fetch`. |
| v3 | el cuerpo de la petición nombrará `createCommitOnBranch` | ese es el nombre del **campo** GraphQL; nunca viaja en la petición. |
| v4 | buscar el nombre de la **operación**, `CreateCommit` | correcto. Aparece como `"operationName":"CreateCommit"` y, cuando viaja el documento, como `mutation CreateCommit`. |

Reglas que se derivan, para quien herede esto:

- **No leer el cuerpo de la respuesta.** Ni `clone().json()` ni `clone().text()`. Usar solo
  `res.ok` / `res.status`.
- **Mirar la petición, y por el nombre de la operación.** El cuerpo está en `init.body` como
  string y se puede leer antes de lanzar el `fetch`, sin streams y sin abortos.
- **No detectar por el texto del aviso "Saved"**: cambia con el idioma y con cualquier
  rediseño.
- GitHub devuelve **200 también cuando el GraphQL trae errores**, así que `res.ok` no basta
  por sí solo: si llega otra petición de commit antes de que dispare la recarga, se cancela
  la programada y decide el reintento (ese es el camino de `STALE_DATA` de Keystatic).
- `persistedExchange` está en la cadena de urql, pero **no interviene en las mutaciones**: el
  commit viaja con el documento completo (~16 KB). Da igual, porque buscar `CreateCommit`
  cubre las dos formas.

**Los dos modos de diagnóstico se quedan**, porque sin ellos esto no se podía depurar: sin
servidor de desarrollo usable y sin navegador automatizable, la caja en pantalla fue la única
fuente de verdad. Van tras un parámetro en la URL y el cliente no los ve:
`?aviso=prueba` monta el overlay 5 s; `?aviso=registro` imprime cada petición a
GitHub/Keystatic —con el tipo, el tamaño y el principio del cuerpo— y **no** recarga.

**Pendiente conocido:** tras la recarga el panel vuelve al *dashboard*, no a la entrada que se
estaba editando, porque se usa `location.reload()` sobre la URL que haya en ese momento. Para
volver a la entrada habría que capturar su URL al detectar el guardado y navegar a ella; hay
que comprobar antes qué hace Keystatic al **crear** una entrada nueva, que redirige por su
cuenta y podría dejar la URL vieja.

---

**Idea original:** si la única manera fiable de refrescar el estado es una carga de página, que
la página se recargue sola y el editor no tenga que acordarse.

**Dónde engancharlo.** La UI de `/keystatic` la monta la integración, no es una página
nuestra, así que no podemos añadirle un `<script>` en el código fuente. Dos enganches
posibles:

1. **Middleware** (`src/middleware.ts`, que ya existe y ya intercepta `/keystatic` para
   redirigir a la rama): interceptar la respuesta HTML de `/keystatic*`, y añadir el script
   antes de `</body>`. Hay que tener cuidado de hacerlo solo con respuestas `text/html` y de
   no tocar las de `/api/keystatic/*`.
2. **`wrangler.jsonc` / Cloudflare**: no aporta nada sobre lo anterior y es más opaco.
   Descartado.

**Qué haría el script.** No conviene depender del DOM ni del texto del aviso de éxito
("Saved"), porque cambia con el idioma y con cualquier rediseño. El guardado es una mutación
GraphQL a la API de GitHub desde el navegador, así que lo robusto es envolver `fetch`:

```js
// esbozo, no es código final
const origFetch = window.fetch;
window.fetch = async (...args) => {
  const res = await origFetch(...args);
  try {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url ?? '';
    const body = args[1]?.body;
    if (url.includes('api.github.com/graphql') &&
        typeof body === 'string' && body.includes('createCommitOnBranch')) {
      const clon = res.clone();                      // no consumir el cuerpo original
      clon.json().then((d) => {
        if (d?.data?.createCommitOnBranch?.ref?.target && !d.errors) {
          setTimeout(() => location.reload(), 1200); // dejar que se vea el aviso de guardado
        }
      }).catch(() => {});
    }
  } catch {}
  return res;
};
```

**Riesgos y límites, sin maquillar:**

- **Depende de dos detalles internos** (el endpoint y el nombre de la mutación). Son
  estables, pero no son API pública: un cambio de Keystatic a su propio proxy lo deja mudo.
  Modo de fallo: deja de recargar y volvemos a la situación actual. No rompe nada.
- **Parpadeo visible** después de cada guardado. En una sesión de carga de contenido, molesta.
  Se puede mitigar recargando solo cuando el formulario no está "sucio", pero eso ya requiere
  leer estado interno de Keystatic y se vuelve frágil.
- **No arregla el fallo B ni el C.** Solo elimina el ritual de la recarga.
- **Riesgo de bucle** si se recarga mientras hay un guardado en vuelo. El `setTimeout` lo
  reduce, no lo elimina del todo.
- Monkey-patch de `fetch` en una página de administración: aceptable, pero es el tipo de cosa
  que hay que dejar documentada y con un comentario claro, o el próximo que lea el middleware
  no entenderá por qué está ahí.

**Veredicto:** es el camino de menor riesgo técnico para quitar la recarga, y vive en nuestro
código, pero trata el síntoma. Si la Opción 0 se confirma, el beneficio marginal baja bastante.

### Opción B — parchear la dependencia (detalle)

**Idea:** aplicar el arreglo de §2 en `node_modules` de forma reproducible. Es la corrección
*correcta*, no un apaño: restituye en modo GitHub lo que la librería ya hace en modo local.

**Mecánica concreta:**

1. `npm i -D patch-package` y añadir `"postinstall": "patch-package"` a `package.json`.
2. Editar a mano `node_modules/@keystatic/core/dist/keystatic-core-ui.js` (y, si el runtime
   los usa, sus gemelos `.node.js` / `.worker.js` — hay que comprobar cuál carga el Worker de
   Cloudflare, no asumirlo).
3. `npx patch-package @keystatic/core` genera `patches/@keystatic+core+0.6.9.patch`, que se
   commitea.
4. Verificar con `npm run cf:preview` (runtime real de Workers) y luego en producción.

**Lo que hay que mirar con lupa antes:**

- El parche va sobre **bundles minificados/compilados**, no sobre fuente. El `.patch` queda
  ilegible y se rompe con cualquier cambio de versión, incluso de parche.
- Hay **varios bundles** con la misma función (`keystatic-core-ui.js` y variantes `.node`,
  `.worker`, `.react-server`). Parchear solo uno puede dar un comportamiento distinto entre
  dev y producción, que es la peor clase de bug.
- `setTreeSha` espera un **sha de árbol**, no el oid del commit; hay que usar
  `await treeSha(tree)` sobre el árbol hidratado, como hace el camino local. Equivocarse aquí
  envenena la caché y los guardados empiezan a fallar de formas raras.
- `patch-package` corre en `postinstall`: **el build de Cloudflare también debe aplicarlo**.
  Si `npm ci` en CI no lo ejecuta, producción corre sin parche y dev con parche.
- Implica **servir un CMS modificado** al cliente. Si algo se comporta raro, el primer
  sospechoso somos nosotros y ya no podemos comparar contra "Keystatic tal cual".

**Nota sobre el precedente.** `CLAUDE.md` registra que ya se rechazó parchear Keystatic una
vez. Aquel parche era sobre la **lista de borrado** y se rechazó con razón: ocultaba el error
mientras seguía perdiendo referencias de imágenes. Este es de otra naturaleza — añade una
llamada que la propia librería ya hace en su otro modo de almacenamiento — así que el
precedente no lo descarta automáticamente. Pero sigue siendo un parche a dist.

**Veredicto:** técnicamente es el arreglo bueno y es pequeño; el coste real no es escribirlo
sino mantenerlo (bundles compilados, varios archivos, postinstall en CI). Razonable **si** se
reporta a la vez upstream, con la idea explícita de borrar el parche cuando entre el arreglo.

### Opción C — migrar `contenido` de `fields.document` a `fields.markdoc` (la más prometedora)

Es la salida que señala el propio mantenedor para el fallo B, y no la habíamos considerado.

```js
// hoy, keystatic.config.ts:206
contenido: fields.document({
  label: 'Contenido', formatting: true, dividers: true, links: true,
  images: { directory: 'public/images/entradas', publicPath: '/images/entradas/' },
}),

// destino (a confirmar opción por opción)
contenido: fields.markdoc({
  label: 'Contenido',
  extension: 'mdoc',
  options: {
    bold: true, italic: true, strikethrough: true, code: true,
    heading: true, blockquote: true, orderedList: true, unorderedList: true,
    link: true, divider: true, table: true,
    image: { directory: 'public/images/entradas', publicPath: '/images/entradas/' },
  },
}),
```

#### Resultado de la prueba (10-oct-2026, rama `prueba-markdoc`)

Se midió ejercitando el campo directamente — `parse()` → `validate()` → `serialize()`, que es
lo que hace Keystatic al abrir y guardar — sobre **las 324 entradas reales**. Detalle de
método: hay que importar el bundle de **navegador**
(`node_modules/@keystatic/core/dist/keystatic-core.js`), porque el de Node deja `parse` y
`serialize` como stubs que lanzan *"unexpected call to function that shouldn't be called in
React server component environment"* — el editor es solo de navegador.

| | `fields.document` (hoy) | `fields.markdoc` |
|---|---|---|
| Imagen en línea en el cuerpo | **lanza** `Unknown inline node type: image`, entrada inabrible | **la conserva**, no rompe |
| Imagen cuyo archivo falta | la sustituye por `Missing image x.jpg`, se pierde la referencia | **conserva la referencia** |
| Escapes de Markdown (`\[`, `\_`) | los pierde al reserializar | **los pierde igual** |
| Cuerpos reescritos al 1er guardado | 307 de 324 | 308 de 324 |
| Entradas ilegibles | 0 | 0 |
| Divisor al principio del cuerpo | destruye la entrada al 2º guardado | **igual de destructivo** |

Y además: lector de Keystatic, `npm run build` y HTML renderizado **sin cambios** — el campo
solo afecta al CMS, no al sitio. Las dos salidas serializadas son **byte a byte idénticas** en
las entradas comparadas, así que migrar no añade rotación de contenido respecto de lo que ya
pasaría hoy.

**Conclusión:** la opción C **sí vale la pena, pero no es la cura que prometía**. Gana dos
cosas concretas y valiosas:

1. **Quita el fallo catastrófico.** La imagen en línea deja de dejar la entrada inabrible. El
   escenario que nos rompió `las-trampas-de-virgilio` y puso rojo el CI se vuelve inofensivo.
2. **Mitiga el fallo C.** Una imagen cuyo archivo falta ya no borra la referencia al guardar,
   que es la razón de ser de `scripts/imagenes-pendientes.mjs`.

Y **no** arregla: la pérdida de escapes (idéntica), ni el fallo D de abajo (idéntico). Es
decir, no evita que un guardado reescriba el cuerpo entero; solo evita que el resultado sea
irrecuperable.

**Lo que queda sin probar:** la UI del editor. El servidor de desarrollo no arranca desde el
entorno de comandos del asistente (no puede abrir puertos) y falla igual con el árbol limpio,
así que la pasada manual sigue pendiente: `npm run dev`, abrir media docena de entradas
representativas (una con galería, una con imágenes individuales, una migrada de WordPress, una
con notas al pie) y comprobar que los botones de formato siguen todos ahí. Para esa pasada
conviene poner `storage: { kind: 'local' }` temporalmente, de modo que los guardados vayan al
árbol de trabajo y se puedan leer con `git diff` sin commitear nada en la rama del cliente.

La rama `prueba-markdoc` tiene el cambio aplicado y verificado hasta donde llega lo anterior.

**Veredicto:** es la que más problemas resuelve por unidad de riesgo, y la única que ataca el
fallo B de raíz. Debería probarse antes que A y B.

---

## 7. ¿Soporte, o nuestra propia versión?

**Soporte comercial:** keystatic.com **no publica** ninguna oferta de soporte, consultoría ni
plan enterprise. Lo único comercial es **Keystatic Cloud** (autenticación con GitHub
gestionada, optimización de imágenes), que no cubre nada de lo de aquí. Thinkmill es una
consultora australiana y Keystatic sale de "Thinkmill Labs R&D", así que un contrato de
soporte habría que pedirlo por fuera, no es un producto con precio. Si interesa, el camino es
preguntar directamente por Discord o por Discussions: una pregunta honesta sobre si existe
soporte pago para modo GitHub cuesta nada y da información útil para decidir.

**Patrocinio:** no hay botón de Sponsors en el repositorio. Aportar un PR con el arreglo de
§2 es, en la práctica, la forma más eficaz de "comprar" prioridad: es una línea, con
diagnóstico hecho, y ya hay un issue vecino que lo respalda.

**Fork propio:** posible (MIT) pero hay que mirar el tamaño real de lo que se adopta. No es
un paquete, es un monorepo con el editor de texto rico, los campos, la UI (`@keystar/ui`), la
capa de GitHub/OAuth y las integraciones de framework. Mantener un fork significa heredar el
editor ProseMirror, que es la parte difícil y la que genera justamente esta clase de bugs.
Para un sitio con 324 entradas y un solo editor, **no se paga**.

Lo que **sí** tiene sentido, y es un término medio honesto:

- **Vendorizar solo lo que nos duele.** El modo GitHub es una porción acotada
  (`useUpsertItem`, el cliente de GraphQL, el OAuth). Un fork de esa porción es mucho menos
  que un fork de Keystatic.
- **Reducir la dependencia del editor.** Lo que nos ha mordido dos veces es el editor de
  texto rico reescribiendo archivos. Un camino de salida gradual es que el contenido largo se
  edite como Markdoc "en crudo" (lo que pedía el reportante de #752: un editor tipo CodeMirror),
  dejando Keystatic para los campos estructurados. Eso recorta el radio de daño sin forzar un
  fork, pero cambia la experiencia del cliente y hay que querer pagarlo.
- **Tener una salida preparada.** El contenido son `.mdoc` + `.json` con frontmatter, es decir
  ficheros abiertos. No estamos presos: si Keystatic se abandonara, mover el contenido a otro
  CMS basado en ficheros es trabajo, pero no un rescate.

---

## 8. Recomendación

Revisada el 10-oct-2026, después de medir la opción C.

1. **Desactivar la bomba del fallo D, primero que todo.** Quitar el divisor inicial de las 20
   entradas por la rama `keystatic` y aterrizar en el mismo ciclo el paso 4 del verificador.
   Hasta que eso esté, cualquiera de esas 20 entradas se destruye con dos guardados, y nadie
   se enteraría hasta que un lector echara en falta el poema. Es lo único de esta lista que
   está destruyendo contenido.
2. **Mientras tanto, decirle al cliente que no abra esas 20 entradas.** La lista la imprime
   `node scripts/verificar-keystatic.mjs` (paso 4).
3. **Migrar a `fields.markdoc` (opción C).** Medido y verde en lector, build y render; quita
   el fallo catastrófico de la imagen en línea y mitiga el fallo C. Falta la pasada manual por
   la UI del editor antes de mergear `prueba-markdoc`.
4. **Reportar** el fallo D y el fallo A (§4 bis y §5.1), y comentar en #1626.
5. **Validar la opción 0** con dos guardados reales de entradas *distintas*. Si se confirma,
   la regla de recargar se relaja y gran parte de la molestia desaparece sin código.
6. **Dejar A y B en reserva.** A si el cliente sigue tropezando con la recarga; B solo si el
   fallo A llega a bloquear trabajo de verdad y upstream no responde.
7. **No forkear.** Reevaluar solo si el repositorio se archiva o deja de publicar durante
   varios meses.

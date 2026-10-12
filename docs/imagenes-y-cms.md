# Imágenes: cómo rinde Keystatic y por qué no migramos de CMS

Decisión tomada en octubre de 2026, antes de migrar las ~2.200 imágenes que faltan del
WordPress viejo. La duda era si Keystatic aguanta esa cantidad o si convenía mover las
imágenes a Cloudflare (R2 / Images) o cambiar de CMS (se probó EmDash). **Se optimizaron
las imágenes y se quedaron en el repositorio.** Acá están los números que llevaron a eso,
para no volver a investigarlo.

## Punto de partida

| | Antes | Después | Final proyectado |
|---|---|---|---|
| Imágenes en `public/images` | 88 — **39,3 MB** | 88 — **7,5 MB** | ~2.300 |
| Peso proyectado del total | — | — | **~0,2 GB** (antes: ~2 GB) |
| Archivos versionados | 560 | 560 | ~2.700 |
| Imágenes de más de 1600 px de lado | 19 | **0** | — |
| Referencias pendientes (`scripts/imagenes-pendientes.json`) | 2.239, en 321 de 323 entradas | | |

La peor era `public/images/entradas/llaga/portada.webp`: **3436×4970 px y 3,1 MB** para
mostrarse en una columna de ~700 px.

## ¿Cómo rinde Keystatic con miles de imágenes?

Leído en su propio bundle (`node_modules/@keystatic/core/dist/`), no supuesto:

1. **El panel descarga el árbol completo del repositorio, no las imágenes.** En modo
   GitHub pide `GET /git/trees/{sha}?recursive=1` y lo guarda en IndexedDB (`idb`),
   indexado por el sha del árbol. Cada archivo es **una entrada**: ruta, sha y tamaño. Los
   bytes de las imágenes nunca viajan al panel. Es decir, **el costo es proporcional a la
   cantidad de archivos, no a su peso**, y con ~2.700 entradas el panel no se entera.
2. **El árbol se vuelve a descargar después de cada commit**, porque la caché está
   indexada por su sha y cada guardado produce un sha nuevo. Crece lineal; a esta escala
   es irrelevante.
3. **Al guardar, el archivo viaja en base64** dentro de `additions` de la mutación
   `createCommitOnBranch`. Base64 infla un 33%: una portada de 3 MB se manda como ~4 MB en
   una sola petición. Con las imágenes optimizadas deja de ser un riesgo.
4. **Keystatic no mira la bandera `truncated` del árbol.** GitHub trunca ese endpoint a
   100.000 entradas / ~7 MB. A ~2.700 estamos a dos órdenes de magnitud del corte, así que
   hoy no es un riesgo — pero es un acantilado, no una degradación: si se pasara, Keystatic
   no avisaría, simplemente dejaría de ver archivos.

**Conclusión: el cuello de botella no es Keystatic, es el peso de las imágenes** — y el
peso pesa igual en cualquier CMS que las guarde en el repositorio. Cambiar de CMS por este
motivo sería resolver el problema equivocado.

Lo que sí dolería con 2 GB en el repositorio:

- **El historial de git no se recupera nunca**: reemplazar una foto no libera la anterior.
- **Cada build descarga el repositorio entero.** Workers Builds en el plan gratuito:
  3.000 min/mes, **1 build concurrente**, timeout de 20 min.
- **Clonar se vuelve lento para siempre**, para cualquiera y para el CI.
- **Peso de página real**: el sitio sirve lo que se sube, sin optimización.

## Lo que se hizo

`scripts/optimizar-imagenes.mjs` (nuevo, con `sharp`, que ya venía como dependencia
transitiva de Astro). Lado largo ≤1600 px, re-codificación, `.rotate()` para la
orientación EXIF, `withoutEnlargement` para no estirar las chicas (hay una de 311 px que
se vería borrosa), y nunca escribe un archivo más grande que el original.

**39,3 MB → 7,5 MB (−81%).** Proyectado a las ~2.300 finales: **~0,2 GB en vez de ~2 GB.**

Tres decisiones del script que conviene conocer antes de tocarlo:

- **Mantiene formato y nombre** por defecto, para no reescribir ninguna ruta: cada
  referencia tiene que seguir cumpliendo `/images/<colección>/<slug>/<archivo>` o
  Keystatic deja de poder guardar el ítem.
- **`--webp-codigo`**: convierte a WebP las imágenes que **solo referencia el código** y
  que Keystatic no administra — `public/images/categorias/` (el mapa `CATEGORIA_IMAGENES`
  de `src/pages/index.astro`; la colección `categorias` solo tiene `nombre`, sin campo de
  imagen) y `public/images/home/` (la estampilla de `HoverRevealHero.astro`). Ahí no hay
  lista de borrado de Keystatic que pueda desincronizarse. Son las que más pesaban: las
  diez ilustraciones de categoría pasaron de **8,54 MB a 1,05 MB (−88%)**, contra 4,28 MB
  manteniéndolas en PNG.
- **`--webp-png-sin-alfa`**: un PNG sin canal alfa es una foto guardada en el formato
  equivocado. La galería de `4-seres-monstruosos` tenía una de 575 KB que en WebP quedó en
  217 KB. Esto sí reescribe la referencia dentro del `.mdoc`, pero el archivo se queda en
  su carpeta con su mismo nombre base, así que la convención se mantiene. Un PNG **con**
  alfa no se toca: su transparencia puede ser intencional.

Dos cosas que se probaron y se descartaron:

- **`png({ palette: true })`**: es cuantización con pérdida. Medido sobre las diez
  ilustraciones de categoría da **exactamente el mismo peso** que el lossless (4,28 MB en
  los dos casos), así que el riesgo de bandas no compraba nada.
- **Pasarle la ruta a `sharp`** en vez de un `Buffer`: deja el archivo de origen abierto
  mientras dura el pipeline y en Windows el `rename` del temporal sobre ese mismo archivo
  falla con `EPERM`.

**Calidad por pasos**: redimensionar no alcanza para que toda foto entre en el tope (una
con mucho grano se queda arriba aunque esté bien dimensionada). Se prueba calidad 80 y
solo si no entra se reintenta 72 / 64 / 55, con suelo en 55. La mayoría entra en el primer
paso y conserva la calidad alta.

**La red de seguridad**, que es la mitad del trabajo: `verificar-keystatic.mjs` tiene un
paso 6 que falla si hay una imagen de más de 250 KB o de más de 1600 px de lado. Sin eso
la mejora se degrada sola — basta que alguien suba una foto de 3 MB desde el panel. El
Action `verificar` ya corre ese script, así que el control vive en el PR
`keystatic` → `main`. Las excepciones conscientes van en
`scripts/imagenes-grandes-aceptadas.json`, con el motivo escrito. **Hoy está vacía, y
conviene que siga así**: después de la carga masiva quedaron cinco imágenes por encima del
tope a 1600 px, y ninguna necesitó recorte a mano. Cuatro entraron bajando el lado largo a
1400 px y el escaneo con grano a 1100 px, con `--escribir --lado=1400 --solo=<ruta>`. El
contenido se lee en una columna de ~700 px, así que a 1400 px sigue habiendo el doble de
densidad. **El lado largo es la palanca; bajar la calidad es el último recurso, y anotar
una excepción es el recurso después de ese.**

El script es **idempotente**: no reescribe un archivo si la mejora es menor al 10%, así
que volver a correrlo sobre imágenes ya optimizadas no genera commits de ruido. Ese mínimo
del 10% **no** se aplica a un archivo que ya está fuera de alguno de los dos topes, pero
solo si el resultado queda DENTRO del tope. Las dos mitades de esa regla se aprendieron
una por culpa de la otra:

- Sin la excepción, una foto de 1728 px de lado no se podía arreglar nunca: redimensionarla
  a 1600 gana menos del 10%, así que el optimizador se negaba a tocarla mientras el paso 6
  la seguía rechazando. Un callejón sin salida.
- Sin el "solo si queda dentro", las cinco imágenes que están en el suelo de calidad se
  reescribían en cada corrida ganando un 0%, que es exactamente el ruido que el mínimo del
  10% existe para evitar.

Dos detalles más del mismo paso, los dos medidos en la carga masiva:

- **Cuando el archivo pasa el tope de LADO, la escalera de calidad recibe además el peso
  del original como presupuesto.** Hay que redimensionarlo igual, pero recodificar a
  calidad 80 un original guardado con calidad baja puede salir más pesado, y el script
  nunca escribe un archivo más grande: sin presupuesto se negaba a escribirlo y la imagen
  quedaba fuera de tope para siempre.
- **Tener canal alfa no es lo mismo que usarlo.** `--webp-png-sin-alfa` miraba
  `meta.hasAlpha`, y 29 PNG traían un canal alfa con todos los píxeles opacos: peso puro,
  sin transparencia que preservar. Ahora, si el PNG declara alfa, se comprueba con
  `stats().isOpaque` antes de descartarlo.
- **`--solo=<texto>[,<texto>…]`** limita el recorrido a las rutas que contienen esos
  textos. Es lo que hace posible un arreglo puntual: bajarle el lado a una imagen deja un
  diff de un archivo en vez de recodificar las 1.300 y llenar el historial de blobs.

## Las opciones que no se tomaron

### R2 / Cloudflare Images

Saca el peso del repositorio y de cada build, y da redimensionado automático por URL. El
costo es el que decidió el asunto: **Keystatic no tiene backend de R2** — su
`fields.image()` solo escribe en el repositorio. Habría que reemplazarlo por un campo de
URL, y entonces: el editor **pierde el arrastrar-y-soltar y la previsualización**; aparece
un **segundo lugar** donde subir cosas, con su propio juego de permisos;
`verificar-keystatic.mjs` ya no puede validar contra `public/` y tendría que hacer
peticiones de red; y **un `git revert` deja de restaurar las imágenes**, porque contenido
e imágenes quedan en dos sistemas con historiales distintos.

Con las imágenes optimizadas, lo que esto ganaría es sacar ~0,1 GB del repositorio: poco,
por bastante complejidad.

**DECIDIDO: las imágenes se quedan en el repositorio.** La decisión se tomó con el número
delante, que era justamente el motivo de medir antes de commitear: la carga masiva del
WordPress viejo bajó de 411 MB de originales a **109 MB** en `public/images`, un 73% menos,
y a ese tamaño sacar las imágenes del repositorio no paga las cuatro cosas que se pierden
arriba — sobre todo que el editor conserve arrastrar-y-soltar, y que un `git revert`
siga restaurando las imágenes junto con el contenido. Siguen siendo parte de Keystatic.

Queda como salida si el repositorio vuelve a molestar. Si ese día llega, el orden importa:
decidirlo **antes** de una carga masiva, porque migrar 88 imágenes es trivial y migrar
1.300 no, y porque el historial de git no libera nunca un blob que ya entró.

> Nota: el adaptador ya detecta un binding `IMAGES` en el build, pero las imágenes de
> `public/` se sirven crudas sin pasar por ningún servicio de imagen, así que eso hoy no
> sirve de nada sin reestructurar. Y las transformaciones de Cloudflare Images tienen su
> propia cuota.

### EmDash

Descartada, y además explica los fallos que se vieron al probarla. **EmDash no es
git-based**: guarda el contenido en base de datos (D1/R2/KV) y las páginas lo leen con
*live content collections*, o sea **renderizado por request**.

- Hoy el sitio es estático: Cloudflare sirve archivos desde el borde y el Worker casi no
  corre (solo `/keystatic`). Con EmDash **cada visita** ejecuta el Worker y consulta la
  base; en el plan gratuito el límite de CPU por invocación es chico y una página de texto
  largo lo roza. Cuando lo pasa, Cloudflare devuelve un 5xx. **Eso es el 503 que se vio.**
- El fallo al publicar tiene el mismo origen: la escritura pasa por el Worker y la base,
  no por GitHub.
- Está **en beta preview**.
- Y no resuelve las imágenes: habría que optimizarlas igual.

Para una revista que publica unas pocas veces al mes y no necesita ningún dato por
request, cambiar "el sitio son archivos" por "el sitio es una base de datos" es perder lo
mejor de la arquitectura actual. Las ventajas de EmDash (borradores, publicación
programada, revisiones, búsqueda full-text) son reales, pero son otra conversación: si
alguna hace falta de verdad, vale replantearlo — no por las imágenes.

### Reescribir el historial de git

`git filter-repo` solo tendría sentido si ya se hubieran subido los 2 GB sin optimizar.
Hoy el historial son 65 MB: no vale el riesgo (reescribe todos los shas, rompe la rama
`keystatic` del cliente y cualquier clon). Queda anotado para no redescubrirlo.

## Lo que sigue pendiente

**El script de carga masiva ya está escrito**: `scripts/migrar-imagenes.mjs`. Cargar las
imágenes desde el panel hubiera sido ~321 guardados → ~321 commits → ~321 builds, con
**1 build concurrente** en el plan gratuito; con el script son unos pocos commits y la
optimización se aplica en el mismo paso.

No hizo falta conseguir nada nuevo: la información ya estaba toda en el repositorio y se
cruza sin heurística.

- **La posición** de cada imagen está en `scripts/imagenes-pendientes.json`: la portada con
  su línea YAML verbatim, cada ítem de `galeria`/`imagenesIndividuales` con su índice, y
  cada imagen del cuerpo con un ancla de 80 caracteres del párrafo anterior más su número
  de ocurrencia. Por eso `instalar` no reimplementa la colocación: copia los archivos y
  llama a `imagenes-pendientes.mjs restaurar`.
- **La URL** de cada archivo está en `scripts/migration-report/images-manifest.csv`
  (`entrada_slug,tipo,url_original,ruta_local`), que generó `migrate-wordpress.mjs` al leer
  el WXR. Su `ruta_local` tiene la misma forma que el campo `ruta` del manifiesto, así que
  el cruce es exacto. Medido: las 2.243 referencias pendientes (1.261 archivos distintos)
  resuelven a una URL, 0 huecos.
- **Los archivos** los sigue sirviendo el WordPress viejo: el DNS todavía no cambió.

**El paso del medio es un punto de decisión, a propósito.** `descargar` deja todo en una
carpeta de staging **fuera** del repositorio (~255 MB de originales) y `optimizar` informa
el peso real después de optimizar. Como el historial de git no libera nunca un blob, ese
número se mira antes de commitear nada, y es el que decide si las imágenes entran al
repositorio o si conviene mover todo a R2 primero (ver la sección de R2 más arriba).
`instalar` es el único paso que escribe dentro del repositorio.

Dos cosas que el script resuelve y conviene no redescubrir: el CSV guarda las URLs con las
entidades HTML sin resolver (`&amp;`), y sin desescaparlas la de gstatic devuelve 404; y
dos `ruta_local` no tienen extensión porque vienen de URLs de CDN que no terminan en un
nombre de archivo (`…/resize/540/540?…` → `540`), así que la extensión se toma del
`Content-Type` real de la respuesta y `instalar` corrige esa ruta en el manifiesto.

## Fuentes

- [EmDash & Astro](https://docs.astro.build/en/guides/cms/emdash/)
- [Workers Builds — Limits & pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)
- [Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/)

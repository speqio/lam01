# Piezas guardadas

Componentes que **siguen en el repositorio pero ya no se muestran**. No están rotos ni
obsoletos: se sacaron de su página por una decisión de diagramación y pueden volver.

Este archivo existe porque la otra forma de guardarlos —un comentario en el código y el
commit que los sacó— envejece mal: el comentario se borra en la primera limpieza y el
commit hay que saber que existe para encontrarlo. Acá está el bloque completo y lo que
tiene que seguir en pie para que vuelva a funcionar.

Regla al sacar una pieza: **borrar el uso, no el componente**, y anotarla acá.

---

## Carrusel de categorías del home

**ACTIVO DE NUEVO desde 2026-10-17** — ver la entrada de `CategoriasHoverStack` más
abajo para la pieza que lo reemplazó brevemente y se descartó. Esta sección queda como
referencia de cuándo salió la primera vez y cómo restaurarlo si se vuelve a sacar.

**Qué es.** El abanico de categorías que va entre "Últimas entradas" y "Archivo" en el
home: una fila de tarjetas con la ilustración fija de cada categoría, que se recorre con
arrastre o rueda y tiene el dial "01 / N" debajo. Su gesto está acotado al eje horizontal
(`Observer` + `touch-action: pan-y`), así que es de las pocas piezas con gesto que
funcionan igual en mobile y en desktop.

**Cuándo salió (la primera vez).** 2026-10-14, commit `cbf6af5`. Se sacó del home;
`/categorias` y el enlace del menú nunca se tocaron.

**Qué sigue en pie** (nada de esto hay que recrear):

- `src/components/CategoriasCards.astro` — la pieza entera.
- `CATEGORIA_IMAGENES` en `src/pages/index.astro` — el mapa de ilustración fija por
  categoría. Es una ilustración dedicada y no la portada de la última entrada, que
  cambiaba sola cada vez que se publicaba algo.
- `public/images/categorias/` — esas diez ilustraciones. **Ojo:** sus rutas viven en el
  código, no en Keystatic, así que `imagenes-huerfanas.mjs` o una limpieza a ojo las
  pueden leer como no referenciadas mientras la sección esté fuera. No borrarlas.

**Cómo volver.** Descomentar el import en `src/pages/index.astro`:

```astro
import CategoriasCards from '../components/CategoriasCards.astro';
```

y pegar este bloque donde estaba, entre la sección de "Últimas entradas" y
`<section id="archivo-explorer">`:

```astro
  {
    categorias.length > 0 && (
      <section class="mb-16 md:mb-32 md:mt-24 md:flex md:min-h-[85vh] md:flex-col md:justify-center lg:mb-40 lg:mt-32">
        <div class="mb-6 md:hidden">
          <h2 class="font-headline text-2xl text-ink lg:text-3xl">Categorías</h2>
        </div>

        <div class="mb-6 hidden md:block">
          <span class="mb-2 block font-mono text-xs uppercase tracking-widest text-ink/50">
            Explora nuestro catálogo
          </span>
          <h2 class="font-headline text-4xl leading-none tracking-tight text-ink lg:text-6xl">
            Categorías
          </h2>
        </div>

        <CategoriasCards
          categorias={categorias
            .filter((categoria) => categoria.id in CATEGORIA_IMAGENES)
            .map((categoria) => ({
              slug: categoria.id,
              nombre: categoria.data.nombre,
              coverImage: CATEGORIA_IMAGENES[categoria.id],
            }))}
        />
      </section>
    )
  }
```

**Cómo comprobar que volvió bien.** `npm run build` y abrir el home: tienen que aparecer
las diez categorías con ilustración (las que no tienen imagen dedicada —`sin-categoria`,
`galeria-rectangulo-de-plata`— quedan fuera a propósito, por el `filter`), el dial tiene
que moverse al arrastrar, y el scroll vertical de la página tiene que seguir pasando por
encima del carrusel sin quedar atrapado.

**Si la pieza volviera a cambiar de lugar**, el bloque de arriba es el del home: las
clases de la sección (`min-h-[85vh]`, los márgenes grandes) son de esa página, no del
componente. En otra página hay que escribir su propio envoltorio.

---

## Lista de categorías con reveal en scroll del home

**Qué es.** `src/components/ui/CategoriasScrollReveal.astro` — el primer reemplazo del
carrusel en rueda de arriba: una lista simple de líneas (nombre + cantidad de entradas),
con reveal en scroll, más fiel a la identidad tipográfica del resto del home que un
carrusel con imágenes. Se probaron dos variantes de "archivero" de tarjetas (fan de
pestañas, scroll-stack) antes de llegar a esta y las dos se descartaron.

**Cuándo salió.** 2026-10-16. Reemplazó al carrusel en rueda (que ya estaba fuera del
home desde antes). A su vez fue reemplazada el mismo día por
`CategoriasHoverStack.astro` (ver la entrada siguiente), que tampoco funcionó bien y se
descartó — el home volvió al carrusel en rueda original.

**Qué sigue en pie:**

- `src/components/ui/CategoriasScrollReveal.astro` — la pieza entera, sin tocar.
- `CATEGORIA_IMAGENES` en `src/pages/index.astro` sigue viva (la usa la pieza de arriba,
  `CategoriasCards`), pero esta pieza no la necesita: solo toma `nombre`/`cantidad`/`href`
  por categoría.

**Cómo volver.** Descomentar el import en `src/pages/index.astro`:

```astro
import CategoriasScrollReveal from '../components/ui/CategoriasScrollReveal.astro';
```

y antes de `---` (cierre del frontmatter), volver a calcular los datos que le pasa —se
quitaron junto con el uso, no viven en ningún otro lado:

```ts
/* Cantidad de entradas por categoría, sobre el catálogo COMPLETO (no el tope de 100):
   decide el orden de la lista, no debe mentir por el recorte de la grilla principal.
   Mismo cálculo que ya hace src/pages/categorias.astro. */
const cantidadPorCategoria = new Map<string, number>();
for (const item of catalogoCompleto) {
  cantidadPorCategoria.set(
    item.categoriaSlug,
    (cantidadPorCategoria.get(item.categoriaSlug) ?? 0) + 1
  );
}

const categoriasEnLineas = categorias
  .filter((categoria) => categoria.id !== 'sin-categoria')
  .map((categoria) => ({
    nombre: categoria.data.nombre,
    cantidad: cantidadPorCategoria.get(categoria.id) ?? 0,
    href: `/category/${categoria.id}`,
  }))
  .filter((item) => item.cantidad > 0)
  .sort((a, b) => b.cantidad - a.cantidad);
```

y pegar esto donde estaba, entre la sección de "Últimas entradas" y
`<section id="archivo-explorer">`:

```astro
<CategoriasScrollReveal items={categoriasEnLineas} />
```

---

## Grilla de carpetas de categorías con stack de estampillas al hover

**Qué es.** `src/components/ui/CategoriasHoverStack.astro` — el segundo reemplazo del
carrusel en rueda: carpetas apiladas (grilla real de `N` columnas con filas superpuestas
vía `margin-top` negativo + `z-index` por `nth-child`, agrupamiento siempre seguro porque
las columnas son explícitas por punto de quiebre, nunca `auto-fit`/`flex-wrap`), cada una
con pestaña + triángulo (`clip-path`) + placa, que al hover/tap se inclina en 3D
(`rotateX`) y asoma en abanico hasta 3 estampillas reales (con el dentado
`estampilla-perforada`) de las entradas más recientes de esa categoría.

**Cuándo salió.** 2026-10-16/17, en la misma sesión que reemplazó
`CategoriasScrollReveal.astro`. Se descartó el 2026-10-17 ("no funciona" — el usuario no
llegó a confirmar qué fallaba puntualmente; varias rondas de ajuste a ciegas sin acceso a
navegador para verificar el render real) y el home volvió al carrusel en rueda original.

**Qué sigue en pie:**

- `src/components/ui/CategoriasHoverStack.astro` — la pieza entera, sin tocar.
- `CATEGORIA_IMAGENES` en `src/pages/index.astro` sigue viva (la usa `CategoriasCards`),
  pero esta pieza no la necesita: usa estampillas reales de entradas, no la ilustración
  fija por categoría.

**Cómo volver.** Descomentar el import en `src/pages/index.astro`:

```astro
import CategoriasHoverStack from '../components/ui/CategoriasHoverStack.astro';
```

y antes de `---` (cierre del frontmatter), volver a calcular los datos que le pasa —se
quitaron junto con el uso, no viven en ningún otro lado:

```ts
const cantidadPorCategoria = new Map<string, number>();
for (const item of catalogoCompleto) {
  cantidadPorCategoria.set(
    item.categoriaSlug,
    (cantidadPorCategoria.get(item.categoriaSlug) ?? 0) + 1
  );
}

// Hasta 3 estampillas REALES por categoría (portadas de sus propias entradas, no la
// ilustración fija de CATEGORIA_IMAGENES). catalogoCompleto ya viene ordenado por
// fecha descendente, así que son las más recientes de cada una.
const estampillasPorCategoria = new Map<string, string[]>();
for (const item of catalogoCompleto) {
  if (!item.coverImage) continue;
  const lista = estampillasPorCategoria.get(item.categoriaSlug) ?? [];
  if (lista.length < 3) {
    lista.push(item.coverImage);
    estampillasPorCategoria.set(item.categoriaSlug, lista);
  }
}

const categoriasConImagen = categorias
  .filter((categoria) => categoria.id in CATEGORIA_IMAGENES)
  .map((categoria) => ({
    slug: categoria.id,
    nombre: categoria.data.nombre,
    cantidad: cantidadPorCategoria.get(categoria.id) ?? 0,
    href: `/category/${categoria.id}`,
    estampillas: estampillasPorCategoria.get(categoria.id) ?? [],
  }))
  .sort((a, b) => b.cantidad - a.cantidad);
```

y pegar esto donde estaba, entre la sección de "Últimas entradas" y
`<section id="archivo-explorer">`:

```astro
<CategoriasHoverStack items={categoriasConImagen} />
```

**Antes de reintentarla**, vale la pena pedir una captura de pantalla real del render
(no hay acceso a navegador en este entorno de trabajo) para no volver a ajustar a ciegas
sobre descripciones de texto o referencias de otro sitio.

---

## Hero de partículas del número

`src/components/HoverRevealHero.particulas.astro.bak` — versión anterior del hero del
home, con partículas detrás del título. Se reemplazó por la estampilla 3D que gira. Queda
como `.bak` al lado del componente que lo sustituyó, que es la otra convención que usa
este repositorio para lo mismo; se restaura renombrándolo y apuntando el import de
`src/pages/index.astro` a él.

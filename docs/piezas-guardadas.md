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

**Qué es.** El abanico de categorías que iba entre "Últimas entradas" y "Archivo" en el
home: una fila de tarjetas con la ilustración fija de cada categoría, que se recorre con
arrastre o rueda y tiene el dial "01 / N" debajo. Su gesto está acotado al eje horizontal
(`Observer` + `touch-action: pan-y`), así que es de las pocas piezas con gesto que
funcionan igual en mobile y en desktop.

**Cuándo salió.** 2026-10-14, commit `cbf6af5`. Se sacó del home; `/categorias` y el
enlace del menú nunca se tocaron.

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

## Hero de partículas del número

`src/components/HoverRevealHero.particulas.astro.bak` — versión anterior del hero del
home, con partículas detrás del título. Se reemplazó por la estampilla 3D que gira. Queda
como `.bak` al lado del componente que lo sustituyó, que es la otra convención que usa
este repositorio para lo mismo; se restaura renombrándolo y apuntando el import de
`src/pages/index.astro` a él.

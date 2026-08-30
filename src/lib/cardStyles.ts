// Clases Tailwind compartidas por la diagramación de "card" que reaparece en todo el
// sitio (imagen a la izquierda con badge superpuesto, texto a la derecha): EntryCard,
// SwipeCard, EntryFlipCard3D y la grid de /numeros. Antes eran strings duplicados a
// mano en cada componente — un cambio de diagramación implicaba tocar 4 archivos y
// arriesgarse a que alguno quedara desactualizado.
//
// Solo se centraliza lo que es realmente idéntico en todos los contextos. El shell
// exterior, el body y el CTA de SwipeCard/EntryFlipCard3D quedan aparte a propósito:
// viven dentro de un mazo/abanico con tamaño fijo y su propio mecanismo de interacción
// (la card no es un link entero, así que el CTA usa hover propio en vez de
// group-hover), no una grid a ancho completo como EntryCard/numeros.
export const cardImageWrap = 'relative h-full w-2/5 shrink-0 bg-surface';

// Badge de categoría/metadata sobre la imagen: recuadro con el acid-flash del sistema
// — es justo el rol que la referencia de diseño le da a ese color ("tags, dividers, and
// focused UI edges"), en vez de un tinte de color sobre la foto entera (que la misma
// referencia prohíbe: el acento no va en áreas grandes).
export const cardBadge =
  'absolute left-2 top-2 border border-accent bg-canvas/80 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-accent';

// Variante de card completa (EntryCard, /numeros): imagen que reacciona al hover del
// link que envuelve toda la card.
export const cardShell =
  'group flex h-56 overflow-hidden border border-ink/15 bg-surface transition-colors duration-300 hover:border-accent lg:h-64';

export const cardImage =
  'h-full w-full object-cover grayscale contrast-125 transition-transform duration-500 group-hover:scale-105';

export const cardBody = 'flex w-3/5 flex-col gap-1 p-4 lg:gap-2 lg:p-6';

export const cardTitle = 'font-headline text-lg uppercase leading-[1.05] text-ink lg:text-xl';

export const cardCta =
  'mt-auto font-mono text-xs font-medium uppercase tracking-widest text-accent transition-colors group-hover:underline';

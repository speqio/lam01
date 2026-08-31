// Clases Tailwind compartidas por la diagramación de "card" que reaparece en todo el
// sitio (imagen a la izquierda con badge superpuesto, texto a la derecha): EntryCard,
// UltimasEntradasCarousel, EntryFlipCard3D y la grid de /numeros. Antes eran strings
// duplicados a mano en cada componente — un cambio de diagramación implicaba tocar
// varios archivos y arriesgarse a que alguno quedara desactualizado.
//
// Solo se centraliza lo que es realmente idéntico en todos los contextos. El shell
// exterior, el body y el CTA quedan aparte a propósito: EntryFlipCard3D vive dentro de
// un abanico con tamaño fijo y su propio mecanismo de interacción (la card no es un
// link entero, así que el CTA usa hover propio en vez de group-hover), distinto de una
// grid a ancho completo como EntryCard/numeros o de un mazo donde la card SÍ es un
// link entero, como UltimasEntradasCarousel.
export const cardImageWrap = 'relative h-full w-2/5 shrink-0 bg-surface';

// Badge de categoría/metadata sobre la imagen: fondo sólido (no translúcido) en el
// color de acento con letra en canvas (negro) — necesita contraste garantizado sea
// cual sea la foto de fondo (clara, oscura, con texto encima, lo que sea), así que va
// opaco en vez de dejar que el acid-flash/canvas-80% se mezcle con la imagen.
export const cardBadge =
  'absolute left-2 top-2 bg-accent px-3 py-2 font-mono text-[12px] font-black uppercase tracking-[0.2em] text-canvas drop-shadow-[0_0_1.2px_rgba(0,0,0,0.95)] md:text-sm';

// Variante de card completa (EntryCard, /numeros): imagen que reacciona al hover del
// link que envuelve toda la card.
export const cardShell =
  'group flex h-56 overflow-hidden border border-ink/15 bg-surface transition-colors duration-300 hover:border-accent lg:h-64';

export const cardImage =
  'h-full w-full object-cover grayscale contrast-125 transition-transform duration-500 group-hover:scale-105';

export const cardBody = 'flex w-3/5 flex-col gap-1 p-4 lg:gap-2 lg:p-6';

export const cardTitle = 'font-headline text-lg leading-[1.05] text-ink lg:text-xl';

export const cardCta =
  'mt-auto font-mono text-xs font-medium uppercase tracking-widest text-accent transition-colors group-hover:underline';

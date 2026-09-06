// Clases Tailwind compartidas por la diagramación de "card" que reaparece en todo el
// sitio (imagen a la izquierda con badge superpuesto, texto a la derecha): EntryCard,
// UltimasEntradasCarousel y la grid de /numeros. Antes eran strings duplicados a mano
// en cada componente — un cambio de diagramación implicaba tocar varios archivos y
// arriesgarse a que alguno quedara desactualizado.
//
// Solo se centraliza lo que es realmente idéntico en todos los contextos. El shell
// exterior, el body y el CTA quedan aparte a propósito, distinto de una grid a ancho
// completo como EntryCard/numeros o de un mazo donde la card SÍ es un link entero,
// como UltimasEntradasCarousel. `cardBadge` sí se reusa fuera de esta diagramación
// (EntradasCarousel3D, ArchivoCascade, CategoriasCards) porque el badge en sí — acento
// sólido, texto canvas — es independiente de dónde vaya montada la imagen.
export const cardImageWrap = 'relative h-full w-2/5 shrink-0 bg-surface';

// Badge de categoría/metadata sobre la imagen: fondo sólido (no translúcido) — necesita
// contraste garantizado sea cual sea la foto de fondo (clara, oscura, con texto
// encima, lo que sea), así que va opaco en vez de dejar que el acid-flash/canvas-80% se
// mezcle con la imagen. El color (blanco/negro en oscuro, acento/canvas en claro) lo
// pone la clase "card-badge" en global.css, no una utilidad de Tailwind acá — así un
// solo lugar controla el color en todos los badges del sitio (cards de categoría,
// EntradasCarousel3D, ArchivoCascade, CategoriasCards, /numeros).
export const cardBadge =
  'card-badge absolute left-2 top-2 px-3 py-2 font-mono text-[12px] font-black uppercase tracking-[0.2em] drop-shadow-[0_0_1.2px_rgba(0,0,0,0.95)] md:text-sm';

// Variante de card completa (EntryCard, /numeros): imagen que reacciona al hover del
// link que envuelve toda la card.
export const cardShell =
  'group flex h-56 overflow-hidden border border-ink/15 bg-surface transition-colors duration-300 hover:border-accent lg:h-64';

export const cardImage =
  'h-full w-full object-cover grayscale contrast-125 transition-transform duration-500 group-hover:scale-105';

export const cardBody = 'flex w-3/5 flex-col gap-1 p-4 lg:gap-2 lg:p-6';

export const cardTitle = 'font-headline text-lg leading-[1.05] text-ink lg:text-xl';

// "Leer entrada" (o equivalente) al pie de la card — el subrayado animado (barra que
// crece de 0 a 100% de ancho) es el mismo recurso que usa la nav del Header en
// desktop, no un `underline` de un solo golpe: dos spans (texto + barra) dentro de un
// contenedor `relative`, la card entera ya trae `group` (cardShell) así que alcanza
// con `group-hover` acá.
export const cardCtaWrap = 'relative mt-auto inline-block';

export const cardCta = 'font-mono text-xs font-medium uppercase tracking-widest text-accent';

export const cardCtaUnderline =
  'absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-300 group-hover:w-full';

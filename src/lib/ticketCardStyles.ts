// Clases Tailwind para la card tipo "boleto" (EntradaTicket.astro y las variantes con
// markup propio que copian su misma estética: NumeroSequence.astro desktop,
// numeros.astro), usada en últimas entradas, categoría, archivo, número y números.
// Aparte de cardStyles.ts (que sigue sirviendo a EntryCard.tsx, el único lugar que
// todavía no usa el boleto: /autor) porque el lenguaje visual es distinto: acá el
// borde va dentado (mask-image, ver ticketNotchedEdges) en vez de un borde liso.

// Proporción del boleto: 32% imagen / 68% texto. El 32% de acá tiene que coincidir con
// el --seam-x del mask perforado en global.css (la costura recortada tiene que caer
// justo donde termina la imagen).
//
// La imagen vuelve a ser un recorte a sangre (object-cover, llena TODA la columna) —
// se probó un mockup chico de estampilla ahí (EstampillaFace.astro, perforado +
// viñeta) pero se volvió atrás: se pidió explícitamente que la imagen ocupe el lado
// izquierdo entero otra vez. EstampillaFace.astro sigue existiendo para
// HoverRevealHero.astro nada más.
export const ticketImageWrap = 'relative h-full w-[32%] shrink-0 overflow-hidden bg-surface';

export const ticketImage = 'h-full w-full object-cover';

// Único tamaño de texto para autor/traductor y badge (no el título, que tiene su
// propio tamaño — ver ticketTitle; ni el CTA, que ahora es un botón con su propio
// tamaño — ver ticketCta).
const TICKET_TEXT_SIZE = 'text-[10px] md:text-[11px]';

// Badge de categoría: texto plano, sin interacción — tenía un subrayado que crecía al
// hover, pero se sacó (pedido explícito): el hover del boleto ahora es solo el CTA
// (ver ticketCta más abajo), la categoría no reacciona a nada.
export const ticketBadgeText = `inline-block self-start font-mono lowercase tracking-widest text-ink ${TICKET_TEXT_SIZE}`;

// Shell exterior: sin border recto — la silueta la da `ticketNotchedEdges` (abajo),
// mordiscos semicirculares repetidos en los cuatro bordes, como un boleto real.
export const ticketShell = 'group relative flex overflow-hidden bg-surface';

// Silueta tipo boleto: mordiscos semicirculares repetidos a lo largo de los cuatro
// bordes de la card, MÁS una línea de perforación real (agujeritos, no una línea
// pintada) en la costura entre imagen e info. Se probó primero adaptar la técnica de
// perforado de la estampilla (mask-image de puntos repetidos por TODA la superficie)
// pero, aplicada a una card mucho más grande que la estampilla, se veía como
// agujeritos sobre la foto en vez de una silueta cortada — acá en cambio cada
// mordisco/agujero está confinado a una franja angosta pegada a su borde/costura
// (radio chico, mask-repeat solo en esa dirección), así que el centro de la foto y el
// texto quedan intactos. Cinco capas de mask-image (los 4 bordes + la costura), cada
// una transparente solo en círculos repetidos sobre su línea y opaca en el resto —
// combinadas con mask-composite: intersect para que el resultado sea "transparente si
// CUALQUIERA de las capas lo dice ahí" (el comportamiento por defecto de
// mask-composite, "add"/over, no sirve: una capa opaca taparía de nuevo los
// mordiscos/agujeros de las otras). La regla CSS en sí vive en global.css (varios
// archivos la comparten) — acá solo el nombre de clase, por consistencia con el resto
// de los exports de este archivo.
export const ticketNotchedEdges = 'ticket-notched-edges';

// justify-end: badge, título y autor van alineados abajo, aprovechando el espacio que
// libera el CTA (ahora `absolute` arriba a la derecha, ver ticketCta) — `relative`
// porque ese CTA se posiciona respecto de este contenedor. w-[68%], ver el comentario
// de ticketImageWrap arriba.
export const ticketBody = 'relative flex w-[68%] flex-col justify-end gap-1.5 p-4 lg:gap-2 lg:p-5';

// text-[16px]/text-[18px] (no text-sm/text-base): +2pt sobre el tamaño anterior,
// pedido explícito.
export const ticketTitle = 'font-headline text-[16px] leading-[1.2] text-ink md:text-[18px]';

export const ticketMeta = `font-mono uppercase tracking-widest text-ink-muted ${TICKET_TEXT_SIZE}`;

// CTA "leer entrada" / "ver número": botón con relleno sólido, arriba a la derecha de
// la columna de texto (pedido explícito) — reusa la clase global ".card-badge"
// (definida en global.css, MISMO color que el badge de categoría del resto del
// sitio — EntryCard, /numeros viejo, etc.): letras negras sobre fondo blanco en modo
// oscuro, letras blancas sobre fondo acento (rojo) en modo claro. `ticket-cta` propio
// (además de `.card-badge`) para el hover — pedido explícito: es EL único hover del
// boleto ahora (el badge de categoría perdió el suyo, ver ticketBadgeText), y cambia
// solo el color de letra, no el fondo: rojo (acento) en modo oscuro, negro (ink) en
// modo claro — reglas en global.css junto a `.card-badge`, porque dependen del mismo
// selector de tema (`:root[data-theme='light']`) que ya vive ahí.
//
// right-7/top-8 (no right-4/top-4): un elemento `absolute` mide su offset desde el
// borde del padding-box de ticketBody, NO desde adentro de su propio padding (el
// p-4/p-5 de ticketBody no lo empuja) — mismo ajuste "a mano" que ya hizo falta antes
// para el badge cuando también fue `absolute` (ver historial); right-4/top-4 quedaba
// muy pegado a la esquina, así que se separó más (pedido explícito). Como el CTA ya
// no ocupa un lugar en el flujo del bloque de texto, badge+título+autor (ticketBody,
// justify-end) aprovechan el espacio que el CTA dejó libre y quedan alineados abajo.
export const ticketCta =
  'card-badge ticket-cta absolute right-7 top-8 inline-block rounded-full px-3 py-1.5 font-mono text-[10px] font-black lowercase tracking-normal transition-colors md:text-[11px]';

// Indicador de paginación tipo "dial" para carruseles con scroll-snap nativo: una
// franja delgada donde un segmento (ancho proporcional a 1/total de items) se
// desplaza en función del scrollLeft del carril, acompañado de un contador
// "01 / N". Nace en NumeroSequence.astro (carrusel de entradas en /numero/[slug]
// en mobile) y se centraliza acá para poder reusarlo en cualquier otro carrusel
// horizontal con scroll-snap del sitio sin rederivar la diagramación.
//
// Solo las clases viven acá, igual que cardStyles.ts — el comportamiento (el
// listener de scroll que mueve el thumb y actualiza el contador vía GSAP) se
// queda en el componente que lo usa, porque siempre depende de qué elemento es
// el carril con data-attributes propios de cada caso.
export const dialWrap = 'flex items-center gap-3 px-4';

export const dialCount = 'shrink-0 font-mono text-xs tabular-nums tracking-widest text-ink-muted';

export const dialTrack = 'relative h-[3px] flex-1 overflow-hidden rounded-full bg-ink/15';

export const dialThumb = 'absolute inset-y-0 left-0 rounded-full bg-accent';

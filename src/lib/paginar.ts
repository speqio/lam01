/**
 * Paginación del cuerpo de una entrada en hojas de tamaño fijo, para el libro
 * (EntradaLibro.astro).
 *
 * Mide en el navegador: necesita geometría real, así que corre sobre una caja oculta del tamaño
 * exacto de la hoja y con la misma tipografía que tendrá la hoja de verdad.
 *
 * POR QUÉ NO BASTA CORTAR ENTRE PÁRRAFOS. En este archivo hay 504 párrafos de más de 1.200
 * caracteres: por sí solos pasan de una hoja. Hay que trocear dentro del párrafo, y para eso se
 * usa `Range` + `extractContents()` en vez de cortar cadenas de texto: así el marcado interno
 * (`em`, `strong`, `a`, `br`), que es justo lo que abunda en estos textos, se reconstruye solo
 * en las dos mitades.
 *
 * INVARIANTE: el texto de todas las hojas concatenado tiene que ser igual al del cuerpo
 * original. Perder una palabra acá no da ningún error, solo un texto incompleto, así que
 * `textoDeHojas()` existe para comprobarlo desde el modo de diagnóstico.
 */

export interface OpcionesPaginado {
  /** Ancho útil de la hoja, en px. */
  ancho: number;
  /** Alto útil de la hoja, en px. */
  alto: number;
  /** Clases que se aplican a la caja de medición para que la tipografía coincida con la hoja. */
  clases?: string;
}

export interface Hoja {
  /** Contenido de la hoja, listo para insertar. */
  nodos: Node[];
  /** Hoja de un bloque especial (imagen o galería): va sola y a página completa. */
  especial: boolean;
}

export interface ResultadoPaginado {
  hojas: Hoja[];
  /** Mediciones hechas, para el diagnóstico. */
  mediciones: number;
  /** Milisegundos que tardó. */
  ms: number;
}

const esEspecial = (nodo: Node): boolean =>
  nodo.nodeType === 1 && (nodo as HTMLElement).hasAttribute('data-bloque-especial');

/** Texto de todas las hojas, normalizado, para comprobar que no se perdió nada. */
export function textoDeHojas(hojas: Hoja[]): string {
  return hojas
    .flatMap((h) => h.nodos.map((n) => n.textContent ?? ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mismo normalizado, para el lado del original. */
export function textoNormalizado(el: HTMLElement): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Lista plana de los nodos de texto de un elemento, con su largo acumulado. Sirve para traducir
 * un offset global (de todo el bloque) a un par (nodo, offset local), que es lo que entiende
 * `Range`.
 */
function nodosDeTexto(raiz: Node): { nodo: Text; largo: number }[] {
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const lista: { nodo: Text; largo: number }[] = [];
  let actual = walker.nextNode();
  while (actual) {
    const texto = actual as Text;
    if (texto.data.length > 0) lista.push({ nodo: texto, largo: texto.data.length });
    actual = walker.nextNode();
  }
  return lista;
}

/** Traduce un offset global dentro del bloque a (nodo de texto, offset local). */
function posicionEn(
  lista: { nodo: Text; largo: number }[],
  offset: number
): { nodo: Text; local: number } | null {
  let restante = offset;
  for (const item of lista) {
    if (restante <= item.largo) return { nodo: item.nodo, local: restante };
    restante -= item.largo;
  }
  const ultimo = lista[lista.length - 1];
  return ultimo ? { nodo: ultimo.nodo, local: ultimo.largo } : null;
}

/**
 * Parte un bloque que no cabe entero. Deja en `bloque` lo que entra y devuelve el resto como un
 * elemento nuevo del mismo tipo, o `null` si no se pudo partir.
 */
function partirBloque(
  bloque: HTMLElement,
  caja: HTMLElement,
  alto: number,
  contarMedicion: () => void
): HTMLElement | null {
  const lista = nodosDeTexto(bloque);
  const total = lista.reduce((a, b) => a + b.largo, 0);
  if (total === 0) return null;

  const topeCaja = caja.getBoundingClientRect().top;
  const cabe = (offset: number): boolean => {
    const pos = posicionEn(lista, offset);
    if (!pos) return false;
    const rango = document.createRange();
    rango.setStart(lista[0].nodo, 0);
    rango.setEnd(pos.nodo, pos.local);
    contarMedicion();
    const rect = rango.getBoundingClientRect();
    // Un rango vacío devuelve un rect en cero: se considera que cabe.
    if (rect.height === 0) return true;
    return rect.bottom - topeCaja <= alto;
  };

  // Búsqueda binaria del último offset que entra.
  let bajo = 0;
  let altoIdx = total;
  while (bajo < altoIdx) {
    const medio = Math.ceil((bajo + altoIdx) / 2);
    if (cabe(medio)) bajo = medio;
    else altoIdx = medio - 1;
  }

  // No cortar una palabra por la mitad: retroceder al último espacio.
  let corte = bajo;
  const textoPlano = lista.map((l) => l.nodo.data).join('');
  while (corte > 0 && !/\s/.test(textoPlano[corte] ?? ' ')) corte--;
  // Si retroceder se comió todo (una sola palabra larguísima), volver al corte medido.
  if (corte === 0) corte = bajo;
  // Si ni una palabra entra, se acepta el desborde de la primera línea antes que colgarse.
  if (corte === 0) return null;

  const pos = posicionEn(lista, corte);
  if (!pos) return null;

  const resto = document.createRange();
  resto.setStart(pos.nodo, pos.local);
  resto.setEnd(bloque, bloque.childNodes.length);
  const fragmento = resto.extractContents();
  if (!(fragmento.textContent ?? '').trim()) return null;

  // La continuación conserva el tipo y los atributos del bloque, así que hereda su estilo.
  const continuacion = bloque.cloneNode(false) as HTMLElement;
  continuacion.removeAttribute('id');
  continuacion.dataset.continuacion = '';
  continuacion.appendChild(fragmento);
  return continuacion;
}

/**
 * Pagina el contenido de `origen` (no lo modifica: trabaja sobre una copia) en hojas de
 * `ancho` x `alto`.
 */
export function paginar(origen: HTMLElement, opciones: OpcionesPaginado): ResultadoPaginado {
  const arranque = performance.now();
  let mediciones = 0;
  const contarMedicion = () => {
    mediciones++;
  };

  const caja = document.createElement('div');
  caja.setAttribute('aria-hidden', 'true');
  if (opciones.clases) caja.className = opciones.clases;
  Object.assign(caja.style, {
    position: 'fixed',
    top: '0',
    // Fuera de pantalla en vez de display:none o visibility:hidden, que no dan geometría.
    left: '-200vw',
    width: `${opciones.ancho}px`,
    height: `${opciones.alto}px`,
    // overflow:hidden crea un contexto de formato propio: evita que los márgenes de los
    // párrafos se colapsen hacia fuera y falseen la medición.
    overflow: 'hidden',
  });
  document.body.appendChild(caja);

  // Cola de bloques por colocar. Se clona para no tocar el DOM real de la entrada.
  const cola: Node[] = Array.from(origen.cloneNode(true).childNodes).filter(
    (n) => n.nodeType === 1 || (n.textContent ?? '').trim() !== ''
  );

  const hojas: Hoja[] = [];
  const cerrarHoja = () => {
    const nodos = Array.from(caja.childNodes);
    if (nodos.length) {
      nodos.forEach((n) => caja.removeChild(n));
      hojas.push({ nodos, especial: false });
    }
  };

  let vueltas = 0;
  const limite = 20000; // red de seguridad contra un bucle infinito

  while (cola.length && vueltas++ < limite) {
    const bloque = cola.shift() as Node;

    if (esEspecial(bloque)) {
      cerrarHoja();
      hojas.push({ nodos: [bloque], especial: true });
      continue;
    }

    caja.appendChild(bloque);
    contarMedicion();
    if (caja.scrollHeight <= opciones.alto) continue;

    // No entra.
    caja.removeChild(bloque);
    if (caja.childNodes.length > 0) {
      // Hay contenido previo: se cierra la hoja y este bloque se reintenta en la siguiente.
      cerrarHoja();
      cola.unshift(bloque);
      continue;
    }

    // Hoja vacía y el bloque no entra: hay que trocearlo.
    caja.appendChild(bloque);
    const continuacion =
      bloque.nodeType === 1
        ? partirBloque(bloque as HTMLElement, caja, opciones.alto, contarMedicion)
        : null;
    if (continuacion) {
      cola.unshift(continuacion);
    }
    // Con o sin troceo, se cierra la hoja: si no se pudo partir, se acepta que esta hoja
    // desborde antes que entrar en un bucle infinito.
    cerrarHoja();
  }

  cerrarHoja();
  caja.remove();

  return { hojas, mediciones, ms: Math.round(performance.now() - arranque) };
}

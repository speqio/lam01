/**
 * Reparto del cuerpo de una entrada en "pliegos": grupos de dos columnas que entran en una
 * pantalla, apilados verticalmente.
 *
 * POR QUÉ NO BASTA `columns: 2`. El navegador equilibra las dos columnas, así que en la entrada
 * mediana de este sitio (10.100 caracteres) cada columna mide 2,6 pantallas: habría que bajar
 * 2,6 pantallas por la izquierda y volver a subirlas para empezar la derecha. Con pliegos se lee
 * izquierda, derecha, y se baja — como un diario.
 *
 * Esta función es solo la REGLA de reparto, sin DOM: recibe los altos ya medidos y devuelve qué
 * bloque va en qué pliego. Vive aparte justamente para poder probarla (ver la verificación en el
 * historial del proyecto); el trabajo de mover nodos queda en el script de EntradaPagina.astro.
 */

export interface BloqueMedido {
  /** Alto del bloque medido en el ancho de una columna, en px. */
  alto: number;
  /** Galería o imagen individual: va sola, a ancho completo. */
  especial: boolean;
}

export interface Pliego {
  /** Índices de los bloques que caen en este pliego, en orden. */
  indices: number[];
  /** `true` para los pliegos de un bloque especial: una sola columna, ancho completo. */
  ancho: boolean;
}

/**
 * Alto de contenido que cabe en un pliego de una pantalla.
 *
 * Un pliego reparte en dos columnas, así que admite el doble de alto que una pantalla; el 0,85
 * deja aire para que el pliego entre entero en el viewport (márgenes del artículo, la barra de
 * progreso, el header).
 */
export function objetivoPorPliego(altoVentana: number): number {
  return altoVentana * 2 * 0.85;
}

/**
 * Agrupa los bloques en pliegos.
 *
 * Reglas:
 *  - Se acumulan bloques hasta que el siguiente pasaría del objetivo; ahí se abre otro pliego.
 *  - Un bloque más alto que el objetivo entero no se parte: queda solo en su pliego (de ahí la
 *    condición `acumulado > 0`, que evita abrir un pliego vacío antes de él).
 *  - Un bloque especial va en un pliego propio a ancho completo, y lo que sigue empieza un
 *    pliego nuevo. Dentro de una columna angosta su alto máximo de 80vh desbordaría la caja, y
 *    el scroll horizontal de la galería se fragmentaría entre columnas.
 *  - No se devuelven pliegos vacíos.
 */
export function repartirEnPliegos(bloques: BloqueMedido[], objetivo: number): Pliego[] {
  const pliegos: Pliego[] = [];
  let actual: Pliego | null = null;
  let acumulado = 0;

  for (let i = 0; i < bloques.length; i++) {
    const bloque = bloques[i];

    if (bloque.especial) {
      pliegos.push({ indices: [i], ancho: true });
      actual = null;
      acumulado = 0;
      continue;
    }

    if (!actual || (acumulado > 0 && acumulado + bloque.alto > objetivo)) {
      actual = { indices: [], ancho: false };
      pliegos.push(actual);
      acumulado = 0;
    }

    actual.indices.push(i);
    acumulado += bloque.alto;
  }

  return pliegos.filter((p) => p.indices.length > 0);
}

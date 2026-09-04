export function normalizeTitleText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .replace(/^([a-záéíóúüñç])/, (_, letter) => letter.toLocaleUpperCase('es'));
}

interface SplitNumeroTitle {
  titulo: string;
  subtitulo?: string;
}

/**
 * Los números se titulan "Número X: Acompañamiento" (p. ej. "Número 5: Umbrales").
 * El ":" es solo un separador de captura de datos, nunca debería mostrarse tal cual —
 * se corta ahí y la segunda mitad pasa a ser un subtítulo aparte (jerarquía tipográfica
 * distinta, ver HoverRevealHero/NumeroSequence), no una segunda cláusula pegada al
 * título con dos puntos en el medio. Si el título no tiene ":" (p. ej. números viejos
 * sin acompañamiento), no hay subtítulo.
 */
export function splitNumeroTitle(value: string): SplitNumeroTitle {
  const [primero, ...resto] = value.split(':');
  const subtitulo = resto.join(':').trim();

  return {
    titulo: normalizeTitleText(primero),
    subtitulo: subtitulo ? normalizeTitleText(subtitulo) : undefined,
  };
}

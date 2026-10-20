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

const escaparHtml = (valor: string) =>
  valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Títulos de entradas con palabras en cursiva. Keystatic guarda el título como texto plano
 * (es también el campo que genera el slug), así que la cursiva se decide acá, al mostrarlo:
 *
 * - Un segmento entre "…", “…” o «…» va en <em> sin comillas: son títulos de obras.
 * - Excepción: una cita de entrevista (`Nombre: “frase larga…”`, con 4 o más palabras y
 *   llegando hasta el final del título) se deja con comillas y sin cursiva.
 * - `*texto*` fuerza cursiva sin comillas, para los casos que la regla no acierta.
 * - Las comillas sin cerrar se dejan tal cual.
 *
 * `html` va a `set:html`/`dangerouslySetInnerHTML` (todo el texto se escapa). `plano` es el
 * título sin asteriscos y con sus comillas, para `<title>`, meta, aria y el buscador.
 */
export function formatearTitulo(titulo: string): { html: string; plano: string } {
  const plano = titulo.replace(/\*([^*]+)\*/g, '$1');
  const patron = /\*([^*]+)\*|"([^"]+)"|“([^”]+)”|«([^»]+)»/g;
  const finTitulo = titulo.trimEnd().length;

  let html = '';
  let ultimo = 0;
  let coincidencia: RegExpExecArray | null;

  while ((coincidencia = patron.exec(titulo)) !== null) {
    html += escaparHtml(titulo.slice(ultimo, coincidencia.index));
    ultimo = coincidencia.index + coincidencia[0].length;

    const [completo, manual] = coincidencia;
    if (manual !== undefined) {
      html += `<em>${escaparHtml(manual)}</em>`;
      continue;
    }

    const contenido = coincidencia.slice(2).find((grupo) => grupo !== undefined) ?? '';
    const antes = titulo.slice(0, coincidencia.index);
    const esCitaDeEntrevista =
      /:\s*$/.test(antes) &&
      ultimo === finTitulo &&
      contenido.trim().split(/\s+/).length >= 4;

    html += esCitaDeEntrevista ? escaparHtml(completo) : `<em>${escaparHtml(contenido)}</em>`;
  }

  html += escaparHtml(titulo.slice(ultimo));
  return { html, plano };
}

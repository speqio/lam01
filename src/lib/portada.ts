/**
 * Datos de orientación de una imagen de entrada (portada, o cualquier imagen de
 * `imagenesIndividuales`/`galeria`):
 *
 *  - `orientacion`: elige la forma de la caja, 3:4 si es vertical y 4:3 si es horizontal.
 *  - `maxAncho`: ancho máximo al que se puede mostrar sin agrandarla. La imagen rellena la caja
 *    con `object-cover`, y las imágenes del sitio van de 399x467 a 3436x4970: sin este tope las
 *    más chicas saldrían borrosas al estirarse hasta el tamaño del diseño.
 *
 * Los mide la integración `integrations/portadas.mjs` leyendo la cabecera de cada archivo, y
 * los entrega por el módulo virtual `virtual:portadas-orientacion` (el mismo mapa cubre las
 * tres fuentes de imagen, con la ruta pública como clave). Ese rodeo es necesario, no un
 * capricho: las imágenes viven en `public/`, fuera del pipeline de assets de Astro, y el
 * prerender del adaptador de Cloudflare corre en workerd, donde ni `sharp` ni `node:fs` pueden
 * leer del disco (ambas comprobadas acá). La integración, en cambio, corre en Node al cargar la
 * configuración.
 */
// @ts-expect-error — módulo virtual que provee integrations/portadas.mjs
import mapa from 'virtual:portadas-orientacion';

export type OrientacionPortada = 'vertical' | 'horizontal';

export interface DatosPortada {
  orientacion: OrientacionPortada;
  /** En px. `null` cuando no se pudo medir: entonces manda el tope del diseño. */
  maxAncho: number | null;
}

const portadas = mapa as Record<string, DatosPortada>;

/**
 * Devuelve los datos de una portada. Si no está medida —una ruta que no viene del frontmatter,
 * o un archivo que no se pudo leer— asume vertical y sin tope, que es el comportamiento
 * anterior a medir nada.
 */
export function datosPortada(rutaPublica: string | undefined): DatosPortada {
  if (!rutaPublica) return { orientacion: 'vertical', maxAncho: null };
  return portadas[rutaPublica] ?? { orientacion: 'vertical', maxAncho: null };
}

/**
 * Mismo lookup que `datosPortada`, con el nombre que corresponde cuando la ruta es de
 * `imagenesIndividuales`/`galeria` en vez de `portada`. Es la misma función: el mapa que
 * entrega `virtual:portadas-orientacion` ya cubre las tres fuentes por igual.
 */
export const datosImagen = datosPortada;

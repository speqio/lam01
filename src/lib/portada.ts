/**
 * Orientación de la portada de una entrada, para elegir la forma de la estampilla del banner
 * (EntradaBanner.astro): 3:4 si es vertical, 4:3 si es horizontal.
 *
 * Las dimensiones las mide la integración `integrations/portadas.mjs` leyendo la cabecera de
 * cada archivo, y las entrega por el módulo virtual `virtual:portadas-orientacion`. Ese rodeo
 * es necesario, no un capricho: las portadas viven en `public/`, fuera del pipeline de assets
 * de Astro, y el prerender del adaptador de Cloudflare corre en workerd, donde ni `sharp` ni
 * `node:fs` pueden leer del disco (ambas comprobadas acá). La integración, en cambio, corre en
 * Node al cargar la configuración.
 */
// @ts-expect-error — módulo virtual que provee integrations/portadas.mjs
import mapa from 'virtual:portadas-orientacion';

export type OrientacionPortada = 'vertical' | 'horizontal';

const orientaciones = mapa as Record<string, OrientacionPortada>;

/**
 * Devuelve la orientación de una portada. Si no está medida —una ruta que no viene del
 * frontmatter, o un archivo que no se pudo leer— asume `vertical`, que es la forma de
 * estampilla más parecida a una clásica.
 */
export function orientacionPortada(rutaPublica: string | undefined): OrientacionPortada {
  if (!rutaPublica) return 'vertical';
  return orientaciones[rutaPublica] ?? 'vertical';
}

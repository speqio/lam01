import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { normalizeTitleText, splitNumeroTitle } from '../lib/text';

/**
 * Índice del buscador del sitio (SearchModal.tsx): solo entradas, autores, categorías y
 * números — nombres y títulos, no el texto de las entradas. Se genera en el build como un
 * JSON estático y el filtrado se hace en el navegador. Las páginas fijas (inicio, archivo,
 * contacto, proyecto) no se incluyen a propósito.
 */
export type TipoBusqueda = 'entrada' | 'autor' | 'categoria' | 'numero';

export interface ItemBusqueda {
  tipo: TipoBusqueda;
  titulo: string;
  url: string;
  /** Solo entradas: nombre del autor. */
  autor?: string;
  /** Solo entradas: nombre de quien tradujo, si corresponde — también se busca por este nombre. */
  traductor?: string;
  /** Solo autores: si está marcado en Keystatic, el buscador muestra "Traductor" en vez de "Autor". */
  esTraductor?: boolean;
}

// Algunos títulos migrados de WordPress traen etiquetas HTML (<strong>…).
const sinHtml = (texto: string) => texto.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

export const GET: APIRoute = async () => {
  const [entradas, autores, categorias, numeros] = await Promise.all([
    getCollection('entradas'),
    getCollection('autores'),
    getCollection('categorias'),
    getCollection('numeros'),
  ]);
  const nombreAutor = new Map(autores.map((autor) => [autor.id, autor.data.nombre]));

  const items: ItemBusqueda[] = [
    ...entradas.map((entrada) => ({
      tipo: 'entrada' as const,
      titulo: normalizeTitleText(sinHtml(entrada.data.titulo)),
      url: `/${entrada.id}`,
      autor: nombreAutor.get(entrada.data.autor),
      traductor: entrada.data.traducidoPor ? nombreAutor.get(entrada.data.traducidoPor) : undefined,
    })),
    ...autores.map((autor) => ({
      tipo: 'autor' as const,
      titulo: autor.data.nombre,
      url: `/autor/${autor.id}`,
      esTraductor: autor.data.esTraductor || undefined,
    })),
    ...categorias.map((categoria) => ({
      tipo: 'categoria' as const,
      titulo: normalizeTitleText(categoria.data.nombre),
      url: `/category/${categoria.id}`,
    })),
    // "sin-numero" no tiene página pública (ver src/pages/[slug].astro).
    ...numeros
      .filter((numero) => numero.id !== 'sin-numero')
      .map((numero) => {
        const { titulo, subtitulo } = splitNumeroTitle(numero.data.titulo);
        return {
          tipo: 'numero' as const,
          titulo: subtitulo ? `${titulo}: ${subtitulo}` : titulo,
          url: `/${numero.id}`,
        };
      }),
  ];

  return new Response(JSON.stringify(items), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};

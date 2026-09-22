import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const autores = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/autores' }),
  schema: z.object({
    nombre: z.string(),
    foto: z.string().optional(),
    biografia: z.string(),
    metaTitulo: z.string().optional(),
    metaDescripcion: z.string().optional(),
  }),
});

const categorias = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/categorias' }),
  schema: z.object({
    nombre: z.string(),
    metaTitulo: z.string().optional(),
    metaDescripcion: z.string().optional(),
  }),
});

const numeros = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/numeros' }),
  schema: z.object({
    titulo: z.string(),
    fecha: z.coerce.date(),
    portada: z.string(),
    descripcion: z.string().optional(),
    metaTitulo: z.string().optional(),
    metaDescripcion: z.string().optional(),
  }),
});

const entradas = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdoc}', base: './src/content/entradas' }),
  schema: z.object({
    titulo: z.string(),
    fecha: z.coerce.date(),
    numero: z.string(),
    autor: z.string(),
    // Opcional: quién tradujo la entrada (relación con autores). `autor` sigue siendo la
    // autoría original — ver keystatic.config.ts.
    traducidoPor: z.string().optional(),
    categoria: z.string(),
    portada: z.string().optional(),
    portadaAlt: z.string().optional(),
    // Todas las entradas ya migradas a esta forma (script de migración, ver commit) —
    // coincide con el campo de Keystatic (fields.array(fields.object({imagen, leyenda}))).
    // `imagen` es opcional acá a propósito: un espacio vacío (`- {}`) no debe tumbar todo el
    // build (una sola entrada inválida frena el deploy de todo el sitio). Keystatic ya lo exige
    // como obligatorio; la página de la entrada ignora los ítems sin imagen.
    galeria: z.array(z.object({ imagen: z.string().optional(), alt: z.string().optional(), leyenda: z.string().optional() })).optional(),
    // Después de qué bloque (párrafo/verso, contando desde 1) del cuerpo va la
    // galería — sin valor, se mantiene al final de la entrada (comportamiento previo).
    galeriaPosicion: z.number().int().min(1).optional(),
    // Imágenes sueltas, cada una con su propia posición (mismo criterio que galeriaPosicion).
    imagenesIndividuales: z
      .array(
        z.object({
          imagen: z.string().optional(),
          alt: z.string().optional(),
          leyenda: z.string().optional(),
          posicion: z.number().int().min(1).optional(),
        })
      )
      .optional(),
    extracto: z.string(),
    metaTitulo: z.string().optional(),
    metaDescripcion: z.string().optional(),
    biografiaAutor: z.string().optional(),
    bibliografia: z.string().optional(),
    notas: z.string().optional(),
  }),
});

export const collections = {
  autores,
  categorias,
  numeros,
  entradas,
};

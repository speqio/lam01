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
    categoria: z.string(),
    portada: z.string().optional(),
    // Unión transitoria: la mayoría de las entradas todavía tienen `galeria` como
    // array de strings (forma vieja); las que ya se editaron con leyenda usan la forma
    // nueva. EntradaGaleria.astro normaliza ambas formas al renderizar.
    galeria: z
      .array(z.union([z.string(), z.object({ imagen: z.string(), leyenda: z.string().optional() })]))
      .optional(),
    // Después de qué bloque (párrafo/verso, contando desde 1) del cuerpo va la
    // galería — sin valor, se mantiene al final de la entrada (comportamiento previo).
    galeriaPosicion: z.number().int().min(1).optional(),
    extracto: z.string(),
    metaTitulo: z.string().optional(),
    metaDescripcion: z.string().optional(),
    biografiaAutor: z.string().optional(),
    bibliografia: z.string().optional(),
  }),
});

export const collections = {
  autores,
  categorias,
  numeros,
  entradas,
};

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
    galeria: z.array(z.string()).optional(),
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

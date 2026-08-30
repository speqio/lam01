import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    autores: collection({
      label: 'Autores',
      slugField: 'nombre',
      path: 'src/content/autores/*',
      format: { data: 'json' },
      schema: {
        nombre: fields.slug({ name: { label: 'Nombre' } }),
        foto: fields.image({
          label: 'Fotografía',
          directory: 'public/images/autores',
          publicPath: '/images/autores/',
        }),
        biografia: fields.text({
          label: 'Biografía',
          multiline: true,
        }),
      },
    }),
    categorias: collection({
      label: 'Categorías',
      slugField: 'nombre',
      path: 'src/content/categorias/*',
      format: { data: 'json' },
      schema: {
        nombre: fields.slug({ name: { label: 'Nombre' } }),
      },
    }),
    numeros: collection({
      label: 'Números',
      slugField: 'titulo',
      path: 'src/content/numeros/*',
      format: { data: 'json' },
      schema: {
        titulo: fields.slug({
          name: {
            label: 'Título',
            description: 'Ej. Número 1: Primavera',
          },
        }),
        fecha: fields.date({ label: 'Fecha' }),
        portada: fields.image({
          label: 'Portada',
          directory: 'public/images/numeros',
          publicPath: '/images/numeros/',
        }),
        descripcion: fields.text({
          label: 'Descripción',
          multiline: true,
        }),
      },
    }),
    entradas: collection({
      label: 'Entradas',
      slugField: 'titulo',
      path: 'src/content/entradas/*',
      format: { contentField: 'contenido' },
      schema: {
        titulo: fields.slug({ name: { label: 'Título' } }),
        fecha: fields.date({ label: 'Fecha' }),
        numero: fields.relationship({
          label: 'Número',
          collection: 'numeros',
          validation: { isRequired: true },
        }),
        autor: fields.relationship({
          label: 'Autor',
          collection: 'autores',
          validation: { isRequired: true },
        }),
        categoria: fields.relationship({
          label: 'Categoría',
          collection: 'categorias',
          validation: { isRequired: true },
        }),
        portada: fields.image({
          label: 'Portada',
          directory: 'public/images/entradas',
          publicPath: '/images/entradas/',
        }),
        galeria: fields.array(
          fields.image({
            label: 'Imagen',
            directory: 'public/images/entradas',
            publicPath: '/images/entradas/',
          }),
          {
            label: 'Galería',
            itemLabel: (props) => {
              const value = props.value;
              return value && typeof value === 'object' && 'filename' in value
                ? value.filename || 'Imagen'
                : 'Imagen';
            },
          }
        ),
        extracto: fields.text({
          label: 'Extracto',
          multiline: true,
        }),
        contenido: fields.document({
          label: 'Contenido',
          formatting: true,
          dividers: true,
          links: true,
          images: {
            directory: 'public/images/entradas',
            publicPath: '/images/entradas/',
          },
        }),
      },
    }),
  },
});

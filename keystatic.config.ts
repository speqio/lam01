import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'github',
    repo: { owner: 'speqio', name: 'lam01' },
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
          validation: { isRequired: true },
        }),
        esTraductor: fields.checkbox({
          label: 'Es traductor',
          description:
            'Marca esta casilla si esta persona traduce entradas (además de o en vez de escribirlas). En el buscador del sitio, su ficha aparece con la etiqueta "Traductor" en vez de "Autor".',
          defaultValue: false,
        }),
        metaTitulo: fields.text({
          label: 'Meta título (SEO)',
          description: 'Título para buscadores/redes. Si se deja vacío, se usa el nombre.',
        }),
        metaDescripcion: fields.text({
          label: 'Meta descripción (SEO)',
          description: 'Resumen breve para buscadores/redes (ideal hasta ~160 caracteres).',
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
        metaTitulo: fields.text({
          label: 'Meta título (SEO)',
          description: 'Título para buscadores/redes. Si se deja vacío, se usa el nombre.',
        }),
        metaDescripcion: fields.text({
          label: 'Meta descripción (SEO)',
          description: 'Resumen breve para buscadores/redes (ideal hasta ~160 caracteres).',
          multiline: true,
        }),
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
        fecha: fields.date({ label: 'Fecha', validation: { isRequired: true } }),
        portada: fields.image({
          label: 'Portada',
          directory: 'public/images/numeros',
          publicPath: '/images/numeros/',
          validation: { isRequired: true },
        }),
        descripcion: fields.text({
          label: 'Descripción',
          multiline: true,
        }),
        metaTitulo: fields.text({
          label: 'Meta título (SEO)',
          description: 'Título para buscadores/redes. Si se deja vacío, se usa el título.',
        }),
        metaDescripcion: fields.text({
          label: 'Meta descripción (SEO)',
          description: 'Resumen breve para buscadores/redes (ideal hasta ~160 caracteres).',
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
        fecha: fields.date({ label: 'Fecha', validation: { isRequired: true } }),
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
        traducidoPor: fields.relationship({
          label: 'Traducido por',
          collection: 'autores',
          description:
            'Opcional. Si esta entrada es una traducción, elige quién la tradujo (debe existir como autor). "Autor" arriba sigue siendo la autoría original.',
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
        portadaAlt: fields.text({
          label: 'Portada: texto alternativo (SEO)',
          description:
            'Describe la portada para buscadores y lectores de pantalla (qué se ve, no el título). Si se deja vacío se usa el título de la entrada.',
        }),
        imagenesIndividuales: fields.array(
          fields.object({
            imagen: fields.image({
              label: 'Imagen',
              directory: 'public/images/entradas',
              publicPath: '/images/entradas/',
              validation: { isRequired: true },
            }),
            alt: fields.text({
              label: 'Texto alternativo (SEO)',
              description:
                'Describe la imagen para buscadores y lectores de pantalla (qué se ve, no el título). Si se deja vacío se usa la leyenda o el título de la entrada.',
            }),
            leyenda: fields.text({
              label: 'Leyenda',
              description: 'Opcional — se muestra debajo de la imagen.',
            }),
            posicion: fields.integer({
              label: 'Después del párrafo número',
              description:
                'Cuenta cada párrafo, verso, subtítulo o separador del texto en orden, empezando en 1: con 3, va justo después del tercero. Las imágenes del propio texto también cuentan. Vacío = al final de la entrada.',
              validation: { min: 1 },
            }),
          }),
          {
            label: 'Imágenes individuales',
            itemLabel: (props) => props.fields.leyenda.value || 'Imagen',
          }
        ),
        galeria: fields.array(
          fields.object({
            imagen: fields.image({
              label: 'Imagen',
              directory: 'public/images/entradas',
              publicPath: '/images/entradas/',
              validation: { isRequired: true },
            }),
            alt: fields.text({
              label: 'Texto alternativo (SEO)',
              description:
                'Describe la imagen para buscadores y lectores de pantalla (qué se ve, no el título). Si se deja vacío se usa la leyenda o el título de la entrada.',
            }),
            leyenda: fields.text({
              label: 'Leyenda',
              description: 'Opcional — se muestra debajo de la imagen.',
            }),
          }),
          {
            label: 'Galería carrusel',
            itemLabel: (props) => props.fields.leyenda.value || 'Imagen',
          }
        ),
        galeriaPosicion: fields.integer({
          label: 'Carrusel: después del párrafo número',
          description:
            'Cuenta cada párrafo, verso, subtítulo o separador del texto en orden, empezando en 1: con 3, va justo después del tercero. Las imágenes del propio texto también cuentan. Vacío = al final de la entrada.',
          validation: { min: 1 },
        }),
        extracto: fields.text({
          label: 'Extracto',
          multiline: true,
          validation: { isRequired: true },
        }),
        metaTitulo: fields.text({
          label: 'Meta título (SEO)',
          description: 'Título para buscadores/redes. Si se deja vacío, se usa el título.',
        }),
        metaDescripcion: fields.text({
          label: 'Meta descripción (SEO)',
          description: 'Resumen breve para buscadores/redes (ideal hasta ~160 caracteres). Si se deja vacío, se usa el extracto.',
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
        biografiaAutor: fields.text({
          label: 'Biografía del autor (para esta entrada)',
          description: 'Se muestra al final de la entrada. Independiente de la biografía general del autor, por si esta pieza necesita una atribución distinta (ej. autoría real citada en el texto en vez de "Redacción").',
          multiline: true,
        }),
        bibliografia: fields.text({
          label: 'Bibliografía',
          description: 'Fuentes/referencias citadas, se muestran al final de la entrada.',
          multiline: true,
        }),
        notas: fields.text({
          label: 'Notas',
          description: 'Notas al pie o aclaraciones, se muestran antes de Biografía del autor / Bibliografía.',
          multiline: true,
        }),
      },
    }),
  },
});

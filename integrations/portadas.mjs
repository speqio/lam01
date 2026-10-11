/**
 * Integración que mide la orientación de las portadas de las entradas y la deja disponible
 * para los componentes a través del módulo virtual `virtual:portadas-orientacion`.
 *
 * POR QUÉ UNA INTEGRACIÓN Y NO UNA FUNCIÓN EN src/lib. Las portadas viven en
 * `public/images/entradas/<slug>/…`, fuera del pipeline de assets de Astro, y el sitio las
 * sirve como `<img>` plano, así que las dimensiones solo se pueden sacar leyendo el archivo.
 * Pero el prerender del adaptador de Cloudflare corre en **workerd**, y ahí no se puede:
 *   - `sharp` no existe   -> el build muere con `No such module "chunks/sharp"`
 *   - `node:fs` no puede leer del disco -> `openSync` falla con "operation not permitted"
 * Ambas comprobadas en este proyecto. Una integración, en cambio, corre en Node durante la
 * carga de la configuración, antes y fuera del prerender, donde el disco sí está disponible.
 *
 * Consecuencia a tener en cuenta: el mapa se calcula al arrancar. Una portada nueva subida
 * desde Keystatic se mide en el build siguiente (que es justo lo que ocurre, porque cada
 * guardado dispara un despliegue). En desarrollo hace falta reiniciar `npm run dev`.
 *
 * El lector de cabeceras cubre los tres formatos que usa el sitio (webp, jpeg, png) y solo
 * lee los primeros 64 KB de cada archivo. Comprobado contra sharp: coincide en las 15
 * portadas que hay hoy.
 */
import fs from 'node:fs';
import path from 'node:path';

const MODULO_VIRTUAL = 'virtual:portadas-orientacion';
const RESUELTO = '\0' + MODULO_VIRTUAL;

/** PNG: ancho y alto como enteros big-endian de 32 bits en el chunk IHDR. */
function medirPng(b) {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
}

/** JPEG: hay que recorrer los marcadores hasta un SOF, que es el que lleva las dimensiones. */
function medirJpeg(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marcador = b[i + 1];
    // SOF0-SOF15 menos DHT (c4), JPG (c8) y DAC (cc), que no son de inicio de cuadro.
    if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
      return { alto: b.readUInt16BE(i + 5), ancho: b.readUInt16BE(i + 7) };
    }
    if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
      i += 2;
      continue;
    }
    const largo = b.readUInt16BE(i + 2);
    if (largo <= 0) return null;
    i += 2 + largo;
  }
  return null;
}

/** WebP: tres variantes de chunk, cada una guarda las dimensiones a su manera. */
function medirWebp(b) {
  if (b.length < 30) return null;
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    // Cabecera de cuadro clave: 14 bits por dimensión tras la marca de sincronía.
    return { ancho: b.readUInt16LE(26) & 0x3fff, alto: b.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    // 14 bits de ancho y 14 de alto, empaquetados a partir del byte 21.
    const bits = b.readUInt32LE(21);
    return { ancho: (bits & 0x3fff) + 1, alto: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    // Enteros de 24 bits little-endian, menos uno.
    return {
      ancho: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
      alto: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
    };
  }
  return null;
}

function medirArchivo(absoluta) {
  // Con 64 KB alcanza: en JPEG el SOF puede venir después de un bloque EXIF grande.
  const buffer = Buffer.alloc(65536);
  const fd = fs.openSync(absoluta, 'r');
  let leidos = 0;
  try {
    leidos = fs.readSync(fd, buffer, 0, buffer.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  const b = buffer.subarray(0, leidos);
  return medirPng(b) ?? medirWebp(b) ?? medirJpeg(b);
}

/** Saca las rutas de `portada:` del frontmatter de cada entrada. */
function rutasDePortada(raiz) {
  const dir = path.join(raiz, 'src', 'content', 'entradas');
  if (!fs.existsSync(dir)) return [];
  const rutas = new Set();
  for (const archivo of fs.readdirSync(dir).filter((f) => f.endsWith('.mdoc'))) {
    const texto = fs.readFileSync(path.join(dir, archivo), 'utf8');
    const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(texto);
    if (!fm) continue;
    // El valor puede venir en línea o replegado con ">-" cuando la ruta es larga.
    const m = /^portada:\s*(?:>-\s*\r?\n\s*)?(\S[^\r\n]*)/m.exec(fm[0]);
    if (m) rutas.add(m[1].trim());
  }
  return [...rutas];
}

// Proporción de la caja de la estampilla según orientación (ancho / alto).
const CAJA = { vertical: 3 / 4, horizontal: 4 / 3 };

/**
 * Ancho máximo al que se puede mostrar la portada sin agrandarla.
 *
 * La imagen rellena la caja con `object-cover`, así que manda el lado que se queda corto: si
 * la foto es relativamente más ancha que la caja, el límite lo pone su alto; si es más
 * estrecha, su ancho. Sin esto las portadas chicas —hay una de 399x467— se verían borrosas al
 * estirarse hasta el tope del diseño, que es justo lo que CLAUDE.md pide evitar con las
 * imágenes pequeñas que sube el editor.
 */
function anchoMaximo({ ancho, alto }, orientacion) {
  const caja = CAJA[orientacion];
  return Math.floor(ancho / alto > caja ? alto * caja : ancho);
}

function construirMapa(raiz, log) {
  const mapa = {};
  let horizontales = 0;
  let sinMedir = 0;
  for (const ruta of rutasDePortada(raiz)) {
    let orientacion = 'vertical';
    // Sin medida fiable no se limita el ancho: manda el tope del diseño.
    let maxAncho = null;
    try {
      const medida = medirArchivo(path.join(raiz, 'public', ruta));
      if (medida && medida.ancho > 0 && medida.alto > 0) {
        orientacion = medida.ancho > medida.alto ? 'horizontal' : 'vertical';
        maxAncho = anchoMaximo(medida, orientacion);
      } else {
        sinMedir++;
        log?.warn(`portada sin dimensiones legibles, se asume vertical: ${ruta}`);
      }
    } catch (error) {
      sinMedir++;
      // Una portada que falte o esté corrupta no puede tumbar el build: se asume vertical.
      log?.warn(`no se pudo medir la portada, se asume vertical: ${ruta} (${error.message})`);
    }
    if (orientacion === 'horizontal') horizontales++;
    mapa[ruta] = { orientacion, maxAncho };
  }
  const total = Object.keys(mapa).length;
  log?.info(
    `${total} portadas medidas: ${total - horizontales} verticales, ${horizontales} horizontales` +
      (sinMedir ? `, ${sinMedir} sin medir` : '')
  );
  return mapa;
}

export default function portadas() {
  return {
    name: 'portadas-orientacion',
    hooks: {
      'astro:config:setup': ({ logger, updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'portadas-orientacion',
                resolveId(id) {
                  return id === MODULO_VIRTUAL ? RESUELTO : null;
                },
                load(id) {
                  if (id !== RESUELTO) return null;
                  // Se mide en cada carga del módulo (build y arranque de dev), no en cada
                  // página: Vite cachea el módulo virtual.
                  const mapa = construirMapa(process.cwd(), logger);
                  return `export default ${JSON.stringify(mapa)};`;
                },
              },
            ],
          },
        });
      },
    },
  };
}

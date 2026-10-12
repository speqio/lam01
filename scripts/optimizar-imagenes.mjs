// Optimiza las imágenes de public/images: las redimensiona y las vuelve a codificar.
//
//   node scripts/optimizar-imagenes.mjs                 informe, NO escribe nada
//   node scripts/optimizar-imagenes.mjs --escribir      aplica los cambios
//   node scripts/optimizar-imagenes.mjs --lado=1600 --peso=250
//   node scripts/optimizar-imagenes.mjs --webp-codigo   además pasa a WebP las imágenes
//                                                       que solo referencia el código
//   node scripts/optimizar-imagenes.mjs --webp-png-sin-alfa
//                                                       además pasa a WebP los PNG sin
//                                                       transparencia (fotos mal guardadas)
//
// POR QUÉ: el sitio sirve las imágenes tal como se suben, sin ningún paso de
// optimización (viven en public/, fuera del pipeline de assets de Astro — ver
// integrations/portadas.mjs). Medido en octubre de 2026: 88 imágenes y 39 MB, con
// 19 de ellas de más de 1600 px de lado y una portada de 3436×4970 px y 3,1 MB para
// mostrarse en una columna de ~700 px. Faltan ~2.239 imágenes por migrar del WordPress
// viejo (scripts/imagenes-pendientes.json): a ese ritmo el repositorio terminaría con
// unos 2 GB de imágenes, que el historial de git no libera nunca y que cada build de
// Workers vuelve a descargar.
//
// MANTIENE EL FORMATO Y EL NOMBRE DEL ARCHIVO, a propósito. Convertir a WebP ahorra algo
// más, pero cambia la extensión, y entonces hay que reescribir la referencia en el
// .mdoc/.json, en los dos JSON de scripts/ y en el código que lleva rutas a mano
// (src/pages/index.astro tiene las ilustraciones de categoría, HoverRevealHero.astro la
// estampilla del home). Cada una de esas rutas tiene que seguir cumpliendo la convención
// /images/<colección>/<slug>/<archivo> o Keystatic deja de poder guardar el ítem. No vale
// el riesgo por la diferencia: el ahorro grande viene del redimensionado, no del formato.
// El informe dice igual cuánto daría el WebP, para poder decidirlo con el número delante.
//
// NUNCA AGRANDA (`withoutEnlargement`) y nunca escribe un archivo más grande que el
// original: hay subidas chicas de verdad (237×311) que al estirarlas se verían borrosas.
// `.rotate()` sin argumentos aplica la orientación EXIF antes de redimensionar; sin eso,
// una foto tomada en vertical con el sensor horizontal se guardaría acostada.
//
// EXCEPCIÓN, con --webp-codigo: hay dos carpetas cuyas imágenes NO las administra
// Keystatic y que solo se referencian desde el código — public/images/categorias/ (el
// mapa CATEGORIA_IMAGENES de src/pages/index.astro; la colección `categorias` solo tiene
// `nombre`, sin campo de imagen) y public/images/home/ (la estampilla de
// HoverRevealHero.astro). Ahí sí se puede convertir a WebP y reescribir la referencia,
// porque no hay ningún ítem de Keystatic cuya lista de borrado pueda desincronizarse.
// Son las que más pesan de todo el repositorio: las diez ilustraciones de categoría
// pasan de 8,54 MB a 1,05 MB (-88%), contra 4,28 MB manteniéndolas en PNG.
//
// SALTA LAS PORTADAS PROVISIONALES (scripts/portadas-provisionales.json): son los
// placeholders neutros que genera portadas-provisionales.mjs y que se reemplazan en
// cuanto llega la tapa real. Optimizarlos es trabajo que se tira.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const escribir = args.includes('--escribir');
const webpCodigo = args.includes('--webp-codigo');
const webpPngPlano = args.includes('--webp-png-sin-alfa');

/** Carpetas cuyas imágenes solo referencia el código, nunca Keystatic (ver cabecera). */
const SOLO_CODIGO = [path.join('public', 'images', 'categorias'), path.join('public', 'images', 'home')];
const leerNum = (nombre, porDefecto) => {
  const arg = args.find((a) => a.startsWith(`--${nombre}=`));
  return arg ? Number(arg.split('=')[1]) : porDefecto;
};

/** Lado largo máximo en píxeles. El contenido se lee en una columna de ~700 px; 1600
    deja margen para pantallas de densidad doble sin pasarse. */
const LADO_MAX = leerNum('lado', 1600);
/** Peso máximo deseado por imagen, en KB. Es el mismo tope que comprueba
    verificar-keystatic.mjs, para que las dos herramientas no se desincronicen. */
const PESO_MAX_KB = leerNum('peso', 250);
/** Por debajo de esta mejora no vale reescribir el archivo: ensucia el historial de git
    con un blob nuevo para no ganar nada. Al 10% el script es además casi idempotente —
    volver a correrlo sobre imágenes ya optimizadas no toca nada, en vez de arañar un 3%
    y generar un commit de ruido. */
const MEJORA_MINIMA = 0.1;

const EXT = /\.(jpe?g|png|webp|avif)$/i;

const caminar = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? caminar(path.join(dir, e.name)) : [path.join(dir, e.name)]
      )
    : [];

const provisionalesPath = path.join(root, 'scripts', 'portadas-provisionales.json');
const provisionales = new Set(
  (fs.existsSync(provisionalesPath)
    ? (JSON.parse(fs.readFileSync(provisionalesPath, 'utf8')).archivos ?? [])
    : []
  ).map((p) => path.join(root, 'public', p))
);

const archivos = caminar(path.join(root, 'public', 'images')).filter((f) => EXT.test(f));

const kb = (b) => (b / 1024).toFixed(0) + ' KB';
const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
const rel = (f) => path.relative(root, f).replace(/\\/g, '/');

/* El mismo pipeline para las dos variantes: orientación EXIF, luego redimensionado.
   Se le pasa un Buffer y NO la ruta: con la ruta, sharp deja el archivo de origen
   abierto mientras dura el pipeline, y en Windows el rename del temporal sobre ese
   mismo archivo falla con EPERM. */
const leer = (archivo) => fs.readFileSync(archivo);

const base = (buf) =>
  sharp(buf)
    .rotate()
    .resize({ width: LADO_MAX, height: LADO_MAX, fit: 'inside', withoutEnlargement: true });

/* CALIDAD POR PASOS. Redimensionar a 1600 px no alcanza para que toda foto entre en el
   tope: una imagen con mucho grano o mucho detalle se queda arriba aunque esté bien
   dimensionada. En vez de dejarla pasar (y que el tope de verificar-keystatic.mjs sea
   decorativo) o de bajar la calidad de TODAS, se baja solo la de las que no entran, y
   por pasos: se prueba 80, y si el resultado sigue por encima del tope se reintenta más
   abajo, con un suelo de 55 para no destrozar la imagen. La mayoría entra en el primer
   paso y conserva la calidad alta. */
const PASOS_CALIDAD = [80, 72, 64, 55];

async function recodificarAjustando(buf, formato) {
  // PNG es sin pérdida: no tiene calidad que bajar, un solo intento.
  if (formato === 'png') return { buf: await recodificar(buf, formato), calidad: null };
  let ultimo = null;
  for (const calidad of PASOS_CALIDAD) {
    ultimo = { buf: await recodificar(buf, formato, calidad), calidad };
    if (ultimo.buf.length / 1024 <= PESO_MAX_KB) return ultimo;
  }
  return ultimo;
}

async function recodificar(buf, formato, calidad) {
  const p = base(buf);
  if (formato === 'jpeg') return p.jpeg({ quality: calidad ?? 80, mozjpeg: true }).toBuffer();
  // PNG SIN `palette: true`: es cuantización con pérdida y puede dejar bandas en una
  // ilustración con degradados. Medido sobre las diez de public/images/categorias/:
  // da exactamente el mismo peso que el lossless (4,28 MB en los dos casos), así que
  // el riesgo no compraba nada.
  if (formato === 'png') return p.png({ compressionLevel: 9, effort: 10 }).toBuffer();
  if (formato === 'avif') return p.avif({ quality: (calidad ?? 80) - 25 }).toBuffer();
  return p.webp({ quality: calidad ?? 80 }).toBuffer();
}

let pesoAntes = 0;
let pesoDespues = 0;
let pesoSiWebp = 0;
let saltadas = 0;
let aplicadas = 0;
const fallos = [];
const cambios = [];
/** Pares [ruta pública vieja, ruta pública nueva] de las imágenes que cambiaron de
    extensión. Solo se llena con --webp-codigo. */
const renombrados = [];
const grandesQueQuedan = [];

for (const archivo of archivos) {
  const original = fs.statSync(archivo).size;
  pesoAntes += original;

  if (provisionales.has(archivo)) {
    saltadas += 1;
    pesoDespues += original;
    pesoSiWebp += original;
    continue;
  }

  const buf = leer(archivo);

  let meta;
  try {
    meta = await sharp(buf).metadata();
  } catch (e) {
    fallos.push(`${rel(archivo)}: no se pudo leer (${e.message.split('\n')[0]})`);
    pesoDespues += original;
    pesoSiWebp += original;
    continue;
  }

  // Animados: sharp los aplanaría a un solo fotograma. Se dejan como están.
  if ((meta.pages ?? 1) > 1) {
    saltadas += 1;
    pesoDespues += original;
    pesoSiWebp += original;
    continue;
  }

  // ¿Esta imagen la referencia solo el código? Entonces, con --webp-codigo, se convierte
  // a WebP y se reescribe la referencia (ver cabecera).
  const relPosix = rel(archivo);
  const soloCodigo = SOLO_CODIGO.some((d) =>
    relPosix.startsWith(d.replace(/\\/g, '/') + '/')
  );
  /* Un PNG SIN CANAL ALFA es una foto guardada en el formato equivocado: PNG es sin
     pérdida, así que paga el precio de conservar cada píxel de una imagen que nadie va a
     editar. Medido: la de 4-seres-monstruosos pesaba 575 KB en PNG y ~80 KB en WebP, con
     la misma pinta. Convertirla sí reescribe la referencia dentro del contenido, pero el
     archivo se queda en su carpeta con su mismo nombre base, así que la ruta sigue
     cumpliendo la convención /images/<colección>/<slug>/ que exige Keystatic, y el paso 2
     de verificar-keystatic.mjs lo comprueba después. Un PNG CON alfa no se toca: podría
     ser un recorte cuya transparencia importa. */
  const pngPlano = webpPngPlano && meta.format === 'png' && meta.hasAlpha === false;
  const convertir = (webpCodigo && soloCodigo && meta.format !== 'webp') || pngPlano;

  let nuevo;
  let comoWebp;
  let calidadUsada = null;
  try {
    const r = await recodificarAjustando(buf, convertir ? 'webp' : meta.format);
    nuevo = r.buf;
    calidadUsada = r.calidad;
    comoWebp =
      meta.format === 'webp' || convertir ? nuevo : (await recodificarAjustando(buf, 'webp')).buf;
  } catch (e) {
    fallos.push(`${rel(archivo)}: no se pudo convertir (${e.message.split('\n')[0]})`);
    pesoDespues += original;
    pesoSiWebp += original;
    continue;
  }

  pesoSiWebp += Math.min(comoWebp.length, original);

  const mejora = 1 - nuevo.length / original;
  if (mejora <= MEJORA_MINIMA) {
    pesoDespues += original;
    if (original / 1024 > PESO_MAX_KB) {
      grandesQueQuedan.push(`${rel(archivo)}: ${kb(original)}, ya está al mínimo con este formato`);
    }
    continue;
  }

  pesoDespues += nuevo.length;
  const lado = Math.max(meta.width ?? 0, meta.height ?? 0);
  cambios.push(
    `${relPosix}: ${kb(original)} -> ${kb(nuevo.length)} (-${(mejora * 100).toFixed(0)}%)` +
      (lado > LADO_MAX ? `, ${meta.width}×${meta.height} -> lado ${LADO_MAX}` : '') +
      (convertir ? ' -> .webp' : '') +
      (calidadUsada !== null && calidadUsada < PASOS_CALIDAD[0] ? `, calidad ${calidadUsada}` : '')
  );

  if (escribir) {
    const destino = convertir ? archivo.replace(/\.[^.]+$/, '.webp') : archivo;
    // En un temporal y después rename: sharp no puede leer y escribir el mismo archivo
    // en la misma operación, y un fallo a mitad de camino dejaría la imagen corrupta.
    const tmp = destino + '.tmp';
    fs.writeFileSync(tmp, nuevo);
    fs.renameSync(tmp, destino);
    if (destino !== archivo) {
      fs.unlinkSync(archivo);
      renombrados.push(['/' + relPosix.replace(/^public\//, ''), '/' + rel(destino).replace(/^public\//, '')]);
    }
    aplicadas += 1;
  }
}

/* Reescritura de las referencias de las imágenes renombradas. Recorre el código y el
   contenido (src/** incluye src/content, con sus .json y sus .mdoc) de una sola vez al
   final, para no releer y reescribir el mismo archivo una vez por imagen. */
if (renombrados.length) {
  const fuentes = caminar(path.join(root, 'src'))
    .concat(caminar(path.join(root, 'integrations')))
    .filter((f) => /\.(astro|ts|tsx|js|mjs|json|mdoc)$/.test(f));
  const tocados = [];
  for (const f of fuentes) {
    const antes = fs.readFileSync(f, 'utf8');
    let despues = antes;
    for (const [viejo, nuevoRef] of renombrados) despues = despues.split(viejo).join(nuevoRef);
    if (despues !== antes) {
      fs.writeFileSync(f, despues);
      tocados.push(rel(f));
    }
  }
  console.log(`\nReferencias reescritas en ${tocados.length} archivo(s):`);
  for (const t of tocados) console.log('  - ' + t);

  // Si quedó alguna referencia a un archivo que ya no existe, mejor saberlo acá que en
  // el build. Busca la ruta vieja en todo el repositorio versionado.
  const huerfanas = [];
  for (const [viejo] of renombrados) {
    for (const f of fuentes) {
      if (fs.readFileSync(f, 'utf8').includes(viejo)) huerfanas.push(`${rel(f)} -> ${viejo}`);
    }
  }
  if (huerfanas.length) fallos.push(...huerfanas.map((h) => `referencia huérfana: ${h}`));
}

console.log(`\nImágenes en public/images: ${archivos.length}`);
console.log(`Lado largo máximo: ${LADO_MAX} px · tope de peso: ${PESO_MAX_KB} KB`);
if (saltadas) console.log(`Saltadas (portadas provisionales o animadas): ${saltadas}`);

if (cambios.length) {
  console.log(`\n${escribir ? 'Optimizadas' : 'Se optimizarían'} (${cambios.length})`);
  for (const c of cambios.slice(0, 20)) console.log('  - ' + c);
  if (cambios.length > 20) console.log(`  … y ${cambios.length - 20} más`);
}

if (grandesQueQuedan.length) {
  console.log(`\nSiguen por encima del tope y no se pueden mejorar más (${grandesQueQuedan.length})`);
  for (const g of grandesQueQuedan.slice(0, 10)) console.log('  - ' + g);
  console.log('  Son imágenes que habría que recortar o reemplazar a mano.');
}

if (fallos.length) {
  console.log(`\nErrores (${fallos.length})`);
  for (const f of fallos) console.log('  - ' + f);
}

console.log(`\nPeso total: ${mb(pesoAntes)} -> ${mb(pesoDespues)}`);
if (pesoAntes > 0) {
  console.log(`Reducción: ${(100 - (pesoDespues / pesoAntes) * 100).toFixed(0)}%`);
  console.log(
    `Referencia: convirtiendo todo a WebP serían ${mb(pesoSiWebp)} ` +
      `(${(100 - (pesoSiWebp / pesoAntes) * 100).toFixed(0)}% menos), pero obliga a ` +
      `reescribir cada ruta — ver el comentario de cabecera.`
  );
}

if (!escribir) {
  console.log(
    `\nInforme solamente. Para aplicarlo: node scripts/optimizar-imagenes.mjs --escribir${webpCodigo ? ' --webp-codigo' : ''}`
  );
} else {
  console.log(`\n✔ ${aplicadas} archivo(s) reescrito(s).`);
  console.log('  Comprueba ahora: node scripts/verificar-keystatic.mjs && npm run build');
}

process.exit(fallos.length > 0 ? 1 : 0);

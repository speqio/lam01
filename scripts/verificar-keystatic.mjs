// Comprueba que el contenido se puede editar sin problemas en Keystatic. Correr antes de cada deploy.
//
//   node scripts/verificar-keystatic.mjs
//
// 1. Lee TODOS los ítems con el lector de Keystatic (mismo parser que usa el editor):
//    detecta entradas que Keystatic no puede abrir (p. ej. imágenes dentro de un enlace).
//    También detecta lo que rompería el build de Astro: campos exigidos por el esquema
//    (fecha, extracto, biografía, portada de número) vacíos y espacios de galería sin imagen.
// 2. Comprueba que cada ruta de imagen del contenido sigue la convención de Keystatic
//    (/images/<colección>/<slug>/archivo) y que el archivo existe en public/. Una ruta
//    fuera de convención o un archivo faltante provoca el error de GitHub "A path was
//    requested for deletion which does not exist" o el vaciado del campo al guardar.
// 3. Busca en el cuerpo de las entradas imágenes en línea: un "![...](...)" que comparta
//    línea con otro texto. El campo document de Keystatic solo admite imágenes de bloque
//    (solas en su párrafo) y se niega a abrir la entrada con "Unknown inline node type:
//    image". Cuenta también cuando el "!" es en realidad texto escapado ("\!") pegado a un
//    enlace, p. ej. una llamada de nota al pie: "...democracia\![\[6\]](#_ftn6)". Mientras el
//    escape sigue en el archivo ese caso NO falla: Markdoc lo lee como texto + enlace y el
//    editor lo abre bien. Se marca igual porque es una bomba de tiempo: cada guardado de
//    Keystatic reserializa el cuerpo entero y se come los escapes, así que el próximo
//    guardado (aunque sea para subir una portada) lo convierte en "![" y ahí sí revienta,
//    para el editor y para el lector del paso 1. Pasó con las-trampas-de-virgilio en 7b923c4.
//    Solución en ambos casos: dejar un espacio entre el "!" y el enlace.
//    Detalle completo y reportes upstream: docs/keystatic-upstream.md
//
// Sale con código 1 si encuentra cualquier problema. Las referencias que se quitaron a
// propósito (scripts/imagenes-pendientes.json) no cuentan como problema: ya no están en
// el contenido.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createReader } from '@keystatic/core/reader';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { default: config } = await import(pathToFileURL(path.join(root, 'keystatic.config.ts')).href);
const reader = createReader(root, { ...config, storage: { kind: 'local' } });

let problemas = 0;
const mostrar = (titulo, lista) => {
  if (!lista.length) return;
  problemas += lista.length;
  console.log(`\n${titulo} (${lista.length})`);
  for (const l of lista.slice(0, 15)) console.log('  - ' + l);
  if (lista.length > 15) console.log(`  … y ${lista.length - 15} más`);
};

// 1. Legibilidad
const ilegibles = [];
const camposVacios = [];
const totales = {};
for (const col of Object.keys(config.collections)) {
  const slugs = await reader.collections[col].list();
  totales[col] = slugs.length;
  for (const slug of slugs) {
    try {
      const v = await reader.collections[col].read(slug, { resolveLinkedFiles: true });
      if (v === null) ilegibles.push(`${col}/${slug}: no se pudo leer`);
      else {
        // Campos que Astro exige: si quedan vacíos, el build de todo el sitio falla.
        const vacio = (x) => x === null || x === undefined || String(x).trim() === '';
        const exigidos = { entradas: ['fecha', 'extracto'], numeros: ['fecha', 'portada'], autores: ['biografia'] }[col] ?? [];
        for (const campo of exigidos) if (vacio(v[campo])) camposVacios.push(`${col}/${slug}: falta "${campo}"`);
        for (const lista of ['galeria', 'imagenesIndividuales']) {
          (v[lista] ?? []).forEach((item, i) => {
            if (vacio(item.imagen)) camposVacios.push(`${col}/${slug}: ${lista}[${i}] no tiene imagen`);
          });
        }
      }
    } catch (e) {
      ilegibles.push(`${col}/${slug}: ${String(e.message).split('\n').filter(Boolean).slice(-1)[0]}`);
    }
  }
}
mostrar('Ítems que Keystatic no puede abrir', ilegibles);
mostrar('Campos obligatorios vacíos o espacios de imagen sin imagen (romperían el build)', camposVacios);

// 2. Rutas de imagen
const fueraDeConvencion = [];
const sinArchivo = [];
const cuerpos = [];
for (const col of ['autores', 'numeros', 'entradas']) {
  const dir = path.join(root, 'src', 'content', col);
  for (const f of fs.readdirSync(dir)) {
    const slug = f.replace(/\.(json|mdoc)$/, '');
    const texto = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
    const fm = col === 'entradas' ? texto.split('\n---\n')[0] : texto;
    const cuerpo = col === 'entradas' ? texto.split('\n---\n').slice(1).join('\n---\n') : '';
    if (col === 'entradas') cuerpos.push([slug, cuerpo]);
    const refs = [
      ...[...fm.matchAll(/\/images\/[^"\s)']+/g)].map((m) => m[0]),
      ...[...cuerpo.matchAll(/!\[[^\]]*\]\((\/images\/[^)\s]+)\)/g)].map((m) => m[1]),
    ];
    for (const ref of new Set(refs)) {
      if (!ref.startsWith(`/images/${col}/${slug}/`)) fueraDeConvencion.push(`${col}/${slug}: ${ref}`);
      else if (!fs.existsSync(path.join(root, 'public', ref))) sinArchivo.push(`${col}/${slug}: ${ref}`);
    }
  }
}
mostrar('Rutas de imagen fuera de la convención /images/<colección>/<slug>/', fueraDeConvencion);
mostrar('Rutas de imagen cuyo archivo no existe en public/', sinArchivo);

// 3. Imágenes en línea en el cuerpo (Keystatic no abre la entrada)
const enLinea = [];
for (const [slug, cuerpo] of cuerpos) {
  cuerpo.split(/\n/).forEach((linea, i) => {
    // El texto alternativo puede llevar corchetes escapados (p. ej. la llamada "[\[6\]]").
    for (const m of linea.matchAll(/!\[(?:\\.|[^\]\\])*\]\([^)\s]*\)/g)) {
      // Sola en su línea es una imagen de bloque: correcta.
      const resto = (linea.slice(0, m.index) + linea.slice(m.index + m[0].length)).replace(/\\+$/, '').trim();
      if (resto !== '') enLinea.push(`entradas/${slug}:${i + 1}: ${m[0].slice(0, 40)} junto a texto`);
    }
  });
}
mostrar('Imágenes en línea en el cuerpo: Keystatic no puede abrir la entrada (deja un espacio entre el "!" y el enlace)', enLinea);

// 4. Cuerpos que empiezan por un divisor: dos guardados seguidos borran la entrada.
// Al guardar, Keystatic normaliza cualquier divisor ("* * *", "___") a "---". Si el divisor
// era lo primero del cuerpo, el cuerpo queda empezando por "---", y en la siguiente apertura
// Markdoc lee ese "---" como el principio de un bloque de frontmatter y se traga todo hasta
// el siguiente "---": el editor muestra la entrada mutilada y el guardado siguiente escribe
// esa mutilación en el repositorio. Medido: alfredo-soto-guillen 2133 -> 2122 -> 310 bytes.
// La página publicada no se ve afectada por el primer guardado (allí Markdoc sí ve el
// frontmatter YAML delante), así que esto no rompe el build: hay que detectarlo a mano.
// Da igual el campo: fields.document y fields.markdoc se comportan idénticamente.
const empiezaConDivisor = [];
for (const [slug, cuerpo] of cuerpos) {
  const primera = cuerpo.split('\n').find((l) => l.trim() !== '');
  if (primera && /^\s*(\*\s*){3,}\s*$|^\s*-{3,}\s*$|^\s*_{3,}\s*$/.test(primera)) {
    empiezaConDivisor.push(`entradas/${slug}: empieza por "${primera.trim()}"`);
  }
}
mostrar('Cuerpos que empiezan por un divisor: el segundo guardado desde Keystatic borraría la entrada (quita el divisor inicial)', empiezaConDivisor);

// 5. Simula un guardado real y comprueba que la entrada se puede volver a abrir.
//
// Los pasos 3 y 4 buscan patrones concretos que ya nos han mordido. Este no adivina: pasa
// cada cuerpo por el parse() -> validate() -> serialize() DEL PROPIO CAMPO, que es exactamente
// lo que hace Keystatic al abrir y al guardar, y después intenta reabrir el resultado. Así
// salen también las trampas que todavía no conocemos.
//
// Hace falta el bundle de NAVEGADOR de @keystatic/core: el de Node deja parse/serialize como
// stubs que lanzan "unexpected call to function that shouldn't be called in React server
// component environment", porque el editor es solo de navegador. Por eso tampoco se puede
// reutilizar el campo del config importado arriba, y hay que reconstruirlo con las mismas
// opciones; se detecta por texto cuál de los dos campos usa el config para no quedar
// desincronizado en silencio.
const cuerposCrudos = [];
for (const col of ['entradas']) {
  const dir = path.join(root, 'src', 'content', col);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mdoc'))) {
    const texto = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
    const fm = /^---\n[\s\S]*?\n---\n/.exec(texto);
    cuerposCrudos.push([f.replace(/\.mdoc$/, ''), texto.slice(fm ? fm[0].length : 0)]);
  }
}

const configTexto = fs.readFileSync(path.join(root, 'keystatic.config.ts'), 'utf8');
const usaMarkdoc = /contenido:\s*fields\.markdoc\(/.test(configTexto);
const usaDocument = /contenido:\s*fields\.document\(/.test(configTexto);

if (!usaMarkdoc && !usaDocument) {
  console.log(
    '\n⚠ Paso 5 omitido: no se reconoce el campo "contenido" en keystatic.config.ts.\n' +
      '  Si se cambió de campo, actualizar este paso en scripts/verificar-keystatic.mjs.'
  );
} else {
  const imagen = { directory: 'public/images/entradas', publicPath: '/images/entradas/' };
  const { fields: fieldsUI } = await import(
    pathToFileURL(path.join(root, 'node_modules', '@keystatic', 'core', 'dist', 'keystatic-core.js')).href
  );
  const campo = usaMarkdoc
    ? fieldsUI.markdoc({
        label: 'Contenido',
        extension: 'mdoc',
        options: {
          bold: true, italic: true, strikethrough: true, code: true, heading: true,
          blockquote: true, orderedList: true, unorderedList: true, table: true,
          link: true, divider: true, codeBlock: true, image: imagen,
        },
      })
    : fieldsUI.document({
        label: 'Contenido', formatting: true, dividers: true, links: true, images: imagen,
      });

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const guardar = (cuerpo, slug) => {
    const valor = campo.parse(undefined, {
      content: enc.encode(cuerpo),
      other: new Map(),
      external: new Map(),
      slug,
    });
    return dec.decode(campo.serialize(campo.validate(valor), { slug }).content ?? new Uint8Array());
  };

  const noReabren = [];
  const seVacian = [];
  for (const [slug, cuerpo] of cuerposCrudos) {
    let unaVez;
    try {
      unaVez = guardar(cuerpo, slug);
    } catch (e) {
      noReabren.push(`entradas/${slug}: ya no se puede abrir — ${String(e.message).split('\n')[0]}`);
      continue;
    }
    try {
      guardar(unaVez, slug);
    } catch (e) {
      noReabren.push(
        `entradas/${slug}: se abre hoy, pero tras un guardado ya no — ${String(e.message).split('\n')[0]}`
      );
      continue;
    }
    if (cuerpo.trim() && unaVez.length < cuerpo.length * 0.8) {
      seVacian.push(`entradas/${slug}: un guardado deja ${unaVez.length} de ${cuerpo.length} bytes`);
    }
  }
  mostrar('Entradas que Keystatic no podría reabrir después de guardarlas (guardado simulado)', noReabren);
  mostrar('Entradas que perderían la mayor parte del cuerpo al guardarse (guardado simulado)', seVacian);
}

// 6. Imágenes sin optimizar en public/images.
//
// El sitio sirve las imágenes tal como se suben: viven en public/, fuera del pipeline de
// assets de Astro, y no hay ningún paso de optimización (ver integrations/portadas.mjs).
// Sin este control la cosa se degrada sola: alcanza con que alguien suba una foto de
// 3 MB desde el panel para que vuelva al repositorio —y al historial de git, que no la
// libera nunca— y a la página. Ya pasó: había una portada de 3436×4970 px y 3,1 MB para
// mostrarse en una columna de ~700 px, y 39 MB de imágenes que se quedaron en 7 con
// scripts/optimizar-imagenes.mjs. Con ~2.239 imágenes todavía por migrar del WordPress
// (scripts/imagenes-pendientes.json), la diferencia entre controlarlo y no es ~0,2 GB
// contra ~2 GB en el repositorio.
//
// Los topes son los mismos que usa scripts/optimizar-imagenes.mjs por defecto, y el
// arreglo de cualquier aviso de aquí es correr ese script.
//
// Las portadas provisionales (scripts/portadas-provisionales.json) no cuentan: son los
// placeholders generados que se reemplazan en cuanto llega la tapa real.
const PESO_MAX_KB = 250;
const LADO_MAX = 1600;

const provisionalesPath = path.join(root, 'scripts', 'portadas-provisionales.json');
const provisionales = new Set(
  (fs.existsSync(provisionalesPath)
    ? (JSON.parse(fs.readFileSync(provisionalesPath, 'utf8')).archivos ?? [])
    : []
  ).map((p) => path.join(root, 'public', p))
);

const caminar = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? caminar(path.join(dir, e.name)) : [path.join(dir, e.name)]
      )
    : [];

// sharp llega como dependencia transitiva de Astro, no como dependencia declarada: si
// algún día no está, el control de peso (que es el que importa) tiene que seguir
// funcionando igual, así que el de dimensiones se salta y se avisa.
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.log('\n(aviso: sharp no disponible; no se comprueban las dimensiones de las imágenes)');
}

/* Las que ya están en su piso y se aceptan a propósito (una sola hoy). Sin esta lista el
   control solo podría ser o decorativo o imposible de dejar en verde. */
const aceptadasPath = path.join(root, 'scripts', 'imagenes-grandes-aceptadas.json');
const aceptadas = new Set(
  Object.keys(
    fs.existsSync(aceptadasPath)
      ? (JSON.parse(fs.readFileSync(aceptadasPath, 'utf8')).archivos ?? {})
      : {}
  )
);

const pesadas = [];
const enormes = [];
for (const archivo of caminar(path.join(root, 'public', 'images'))) {
  if (!/\.(jpe?g|png|webp|avif)$/i.test(archivo) || provisionales.has(archivo)) continue;
  const ref = path.relative(path.join(root, 'public'), archivo).replace(/\\/g, '/');
  const peso = fs.statSync(archivo).size;
  if (peso / 1024 > PESO_MAX_KB && !aceptadas.has(`/${ref}`)) {
    pesadas.push(`/${ref}: ${(peso / 1024).toFixed(0)} KB`);
  }
  if (!sharp) continue;
  try {
    const { width = 0, height = 0 } = await sharp(fs.readFileSync(archivo)).metadata();
    if (Math.max(width, height) > LADO_MAX) enormes.push(`/${ref}: ${width}×${height}`);
  } catch {
    // Un archivo que sharp no puede leer ya lo reporta el paso 2 si está referenciado.
  }
}
mostrar(
  `Imágenes de más de ${PESO_MAX_KB} KB (correr: node scripts/optimizar-imagenes.mjs --escribir)`,
  pesadas
);
mostrar(
  `Imágenes de más de ${LADO_MAX} px de lado (correr: node scripts/optimizar-imagenes.mjs --escribir)`,
  enormes
);

console.log(
  '\nLeídos: ' + Object.entries(totales).map(([c, n]) => `${c} ${n}`).join(', ') + '.'
);
if (problemas) {
  console.log(`\n✖ ${problemas} problema(s).`);
  process.exit(1);
}
console.log('✔ Todo el contenido se puede editar en Keystatic sin referencias rotas.');

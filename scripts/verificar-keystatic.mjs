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
//    enlace, p. ej. una llamada de nota al pie: "...democracia\![\[6\]](#_ftn6)". Ese caso
//    escapado es el que hace falta este paso: el lector (paso 1) lo lee como texto y lo deja
//    pasar, pero el editor descarta el escape al abrir la entrada y falla. Y en cuanto el
//    editor vuelve a guardar el archivo, el escape desaparece del disco y entonces el paso 1
//    también falla (es lo que pasó con las-trampas-de-virgilio en 7b923c4: el guardado de
//    una portada reescribió el .mdoc, "\![" quedó como "![" y el Action se puso rojo).
//    Solución en ambos casos: dejar un espacio entre el "!" y el enlace.
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

console.log(
  '\nLeídos: ' + Object.entries(totales).map(([c, n]) => `${c} ${n}`).join(', ') + '.'
);
if (problemas) {
  console.log(`\n✖ ${problemas} problema(s).`);
  process.exit(1);
}
console.log('✔ Todo el contenido se puede editar en Keystatic sin referencias rotas.');

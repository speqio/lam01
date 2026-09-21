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
for (const col of ['autores', 'numeros', 'entradas']) {
  const dir = path.join(root, 'src', 'content', col);
  for (const f of fs.readdirSync(dir)) {
    const slug = f.replace(/\.(json|mdoc)$/, '');
    const texto = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
    const fm = col === 'entradas' ? texto.split('\n---\n')[0] : texto;
    const cuerpo = col === 'entradas' ? texto.split('\n---\n').slice(1).join('\n---\n') : '';
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

console.log(
  '\nLeídos: ' + Object.entries(totales).map(([c, n]) => `${c} ${n}`).join(', ') + '.'
);
if (problemas) {
  console.log(`\n✖ ${problemas} problema(s).`);
  process.exit(1);
}
console.log('✔ Todo el contenido se puede editar en Keystatic sin referencias rotas.');

// Genera una portada provisional para cada número cuyo archivo de portada no existe.
//
// Por qué: la portada de un número es obligatoria en Keystatic, y si el archivo no existe
// Keystatic no deja guardar el número (y al intentarlo manda borrar un archivo inexistente).
// Con un archivo provisional en la ruta exacta, el número se puede editar. Al subir la
// portada real desde Keystatic (o con la migración de imágenes) la provisional se reemplaza.
//
// Uso: node scripts/portadas-provisionales.mjs [--dry-run]
// Registra lo generado en scripts/portadas-provisionales.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src', 'content', 'numeros');
const registro = path.join(root, 'scripts', 'portadas-provisionales.json');
const dryRun = process.argv.includes('--dry-run');

// Colores del sistema de diseño (tailwind.config.mjs): canvas, surface, ink, ink-muted, accent.
const C = { canvas: '#121212', surface: '#292929', ink: '#ffffff', muted: '#a0a0a0', accent: '#a6294a' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svg(titulo) {
  const [principal, ...resto] = titulo.split(':');
  const sub = resto.join(':').trim();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <rect width="900" height="1200" fill="${C.canvas}"/>
  <rect x="40" y="40" width="820" height="1120" fill="none" stroke="${C.surface}" stroke-width="4"/>
  <rect x="80" y="560" width="120" height="6" fill="${C.accent}"/>
  <text x="80" y="640" font-family="sans-serif" font-size="72" font-weight="700" fill="${C.ink}">${esc(principal.trim())}</text>
  ${sub ? `<text x="80" y="705" font-family="sans-serif" font-size="34" fill="${C.muted}">${esc(sub.slice(0, 40))}</text>` : ''}
  <text x="80" y="1100" font-family="sans-serif" font-size="26" letter-spacing="6" fill="${C.muted}">PORTADA PENDIENTE</text>
</svg>`;
}

const generadas = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (!j.portada) continue;
  const destino = path.join(root, 'public', j.portada);
  if (fs.existsSync(destino)) continue;
  generadas.push(j.portada);
  if (dryRun) continue;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const img = sharp(Buffer.from(svg(j.titulo ?? f)));
  const ext = path.extname(destino).toLowerCase();
  await (ext === '.png' ? img.png() : ext === '.webp' ? img.webp() : img.jpeg({ quality: 82 })).toFile(destino);
}

if (!dryRun) {
  const previo = fs.existsSync(registro) ? JSON.parse(fs.readFileSync(registro, 'utf8')).archivos : [];
  const todos = [...new Set([...previo, ...generadas])].sort();
  fs.writeFileSync(registro, JSON.stringify({ archivos: todos }, null, 1) + '\n');
}
console.log(`${dryRun ? '[dry-run] ' : ''}Portadas provisionales: ${generadas.length}`);

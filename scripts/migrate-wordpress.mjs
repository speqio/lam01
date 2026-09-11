#!/usr/bin/env node
// Migra el contenido exportado de WordPress (WXR) a las colecciones de Keystatic de
// este proyecto (autores/categorias/numeros/entradas). Ver el plan de migración para
// el contexto completo de las decisiones tomadas acá (no hay autor confiable por post,
// no hay relación limpia post↔número, no vienen binarios de imagen en el export).
//
// Uso:
//   node scripts/migrate-wordpress.mjs [--entradas <ruta>] [--paginas <ruta>]
//                                      [--out <dir>] [--report <dir>] [--force]
//
// No destructivo por default: si un archivo de salida ya existe, se salta y se anota
// en el reporte — pasar --force para sobreescribir.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import TurndownService from 'turndown';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// --- CLI args -----------------------------------------------------------------
const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const FORCE = args.includes('--force');
const ENTRADAS_XML = argValue('--entradas', 'C:\\Users\\paolin\\Downloads\\entradaslam.xml');
const PAGINAS_XML = argValue('--paginas', 'C:\\Users\\paolin\\Downloads\\paginaslam.xml');
const OUT_DIR = argValue('--out', join(REPO_ROOT, 'src/content'));
const REPORT_DIR = argValue('--report', join(REPO_ROOT, 'scripts/migration-report'));

// --- Helpers de parseo XML ------------------------------------------------------
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  trimValues: false,
});

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (typeof node === 'object' && '#text' in node) return String(node['#text']);
  return '';
}

// Decodificador de entidades mínimo — el contenido HTML pasa por turndown (que ya
// decodifica entidades como parte de su propio parseo de DOM), esto es solo para
// campos de texto plano (título, etc.) que no pasan por ahí.
const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};
function decodeEntities(str) {
  return String(str)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

function readWxr(path) {
  const xml = readFileSync(path, 'utf-8');
  const doc = parser.parse(xml);
  return toArray(doc?.rss?.channel?.item);
}

// --- Normalización de categorías (Fase B) ---------------------------------------
// Taxonomía final del sitio (12 categorías) — ya absorbió las categorías chicas que se
// fundieron a mano en las categorías "padre" acordadas con el usuario:
//   fotografia -> artes-visuales
//   poeticas, ars-poetica, poemas-graficos -> poesia
//   epistolario, retrato, tributo -> homenaje
//   dialogo -> entrevista
//   opinion, pensamiento, literatura -> ensayo
//   testimonio -> (sin destino, no se usa ni como categoría ni como alias)
const CATEGORY_MAP = {
  antologia: 'Antología',
  'artes-visuales': 'Artes Visuales',
  cronica: 'Crónica',
  cuento: 'Cuento',
  ensayo: 'Ensayo',
  entrevista: 'Entrevista',
  homenaje: 'Homenaje',
  poesia: 'Poesía',
  presentacion: 'Presentación',
  prologo: 'Prólogo',
  resena: 'Reseña',
  'sin-categoria': 'Sin categoría',
};

// Nicename de WordPress (tanto de <category domain="category"> como de
// <category domain="post_tag">) -> slug final de CATEGORY_MAP. Cubre tanto los
// nicenames "reales" (identidad) como los que se fusionaron a una categoría padre —
// se reusa igual para resolver categorías y, más abajo, como respaldo por tag cuando
// un post no tiene ninguna categoría real asignada.
const CATEGORY_ALIAS = {
  antologia: 'antologia',
  'artes-visuales': 'artes-visuales',
  fotografia: 'artes-visuales',
  cronica: 'cronica',
  cuento: 'cuento',
  ensayo: 'ensayo',
  opinion: 'ensayo',
  pensamiento: 'ensayo',
  'pensamiento-contemporaneo': 'ensayo',
  literatura: 'ensayo',
  entrevista: 'entrevista',
  dialogo: 'entrevista',
  homenaje: 'homenaje',
  epistolario: 'homenaje',
  retrato: 'homenaje',
  tributo: 'homenaje',
  poesia: 'poesia',
  poeticas: 'poesia',
  'ars-poetica': 'poesia',
  'poemas-graficos': 'poesia',
  presentacion: 'presentacion',
  prologo: 'prologo',
  resena: 'resena',
  'sin-categoria': 'sin-categoria',
};

// Cuando un post no tiene NINGUNA categoría real (domain=category) — 221 de 324 en el
// export real, ver investigación previa — se busca un respaldo entre sus post_tag,
// en este orden de prioridad (géneros específicos primero; "ensayo" al final porque
// ahí caen justamente los tags más genéricos como "literatura"/"pensamiento").
const TAG_FALLBACK_PRIORITY = [
  'cuento',
  'poesia',
  'cronica',
  'entrevista',
  'presentacion',
  'prologo',
  'resena',
  'artes-visuales',
  'homenaje',
  'antologia',
  'ensayo',
];

// --- Utilidades de archivo/YAML --------------------------------------------------
function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function yamlQuoted(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function writeIfAbsent(path, content, report, label) {
  if (existsSync(path) && !FORCE) {
    report.skipped.push(`${label}: ${path} (ya existía, no se sobreescribió)`);
    return false;
  }
  ensureDir(dirname(path));
  writeFileSync(path, content, 'utf-8');
  return true;
}

function extFromUrl(url) {
  const clean = url.split('?')[0];
  const ext = extname(clean).replace('.', '').toLowerCase();
  return ext || 'jpg';
}

function basenameFromUrl(url) {
  const clean = url.split('?')[0];
  return clean.substring(clean.lastIndexOf('/') + 1);
}

// --- Reporte ----------------------------------------------------------------------
const report = {
  postsProcesados: 0,
  postsOmitidos: [],
  categoriasCreadas: [],
  numerosCreados: [],
  postsSinNumero: [],
  categoriasDescartadas: [],
  categoriasPorTag: [],
  skipped: [],
  imageManifest: [], // { slug, tipo, url, rutaLocal }
};

// =================================================================================
// Fase A — Parseo
// =================================================================================
console.log(`Leyendo ${ENTRADAS_XML} ...`);
const entradasItems = readWxr(ENTRADAS_XML);
console.log(`Leyendo ${PAGINAS_XML} ...`);
const paginasItems = readWxr(PAGINAS_XML);

const posts = entradasItems.filter((item) => text(item['wp:post_type']) === 'post');
const attachments = entradasItems.filter((item) => text(item['wp:post_type']) === 'attachment');
const attachmentsById = new Map();
for (const att of attachments) {
  attachmentsById.set(text(att['wp:post_id']), text(att['wp:attachment_url']));
}

const numeroPages = paginasItems.filter((item) => {
  if (text(item['wp:post_type']) !== 'page') return false;
  return /^Número\s+\d+$/i.test(decodeEntities(text(item.title)).trim());
});

console.log(`Posts: ${posts.length} | Páginas de número: ${numeroPages.length} | Attachments indexados: ${attachmentsById.size}`);

// =================================================================================
// Fase B — Categorías
// =================================================================================
ensureDir(join(OUT_DIR, 'categorias'));
for (const [slug, nombre] of Object.entries(CATEGORY_MAP)) {
  const path = join(OUT_DIR, 'categorias', `${slug}.json`);
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify({ nombre }, null, 2) + '\n', 'utf-8');
    report.categoriasCreadas.push(slug);
  }
}

// =================================================================================
// Fase C — Números
// =================================================================================
ensureDir(join(OUT_DIR, 'numeros'));
const postSlugToNumero = new Map();
const PERMALINK_RE = /https?:\/\/laantorchamagacin\.com\/\d{4}\/\d{2}\/\d{2}\/([a-z0-9-]+)\/?/gi;

for (const page of numeroPages) {
  const titulo = decodeEntities(text(page.title)).trim();
  const match = titulo.match(/(\d+)/);
  if (!match) continue;
  const num = parseInt(match[1], 10);
  const numeroSlug = `numero-${String(num).padStart(2, '0')}`;

  const contenido = text(page['content:encoded']);
  let linkMatch;
  PERMALINK_RE.lastIndex = 0;
  while ((linkMatch = PERMALINK_RE.exec(contenido)) !== null) {
    const postSlug = linkMatch[1];
    if (!postSlugToNumero.has(postSlug)) {
      postSlugToNumero.set(postSlug, numeroSlug);
    }
  }

  const path = join(OUT_DIR, 'numeros', `${numeroSlug}.json`);
  if (!existsSync(path)) {
    const pubDate = text(page.pubDate);
    const fecha = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '2026-01-01';
    const data = {
      titulo,
      fecha,
      portada: `/images/numeros/${numeroSlug}-portada.jpg`,
    };
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    report.numerosCreados.push(numeroSlug);
    report.imageManifest.push({
      slug: numeroSlug,
      tipo: 'portada-numero',
      url: '(sin fuente — montar manualmente)',
      rutaLocal: data.portada,
    });
  }
}

const SIN_NUMERO_PATH = join(OUT_DIR, 'numeros', 'sin-numero.json');
if (!existsSync(SIN_NUMERO_PATH)) {
  writeFileSync(
    SIN_NUMERO_PATH,
    JSON.stringify(
      {
        titulo: 'Sin número',
        fecha: new Date().toISOString().slice(0, 10),
        portada: '/images/numeros/sin-numero-portada.jpg',
      },
      null,
      2
    ) + '\n',
    'utf-8'
  );
  report.numerosCreados.push('sin-numero');
}

// =================================================================================
// Fase D — Autor genérico
// =================================================================================
ensureDir(join(OUT_DIR, 'autores'));
const REDACCION_PATH = join(OUT_DIR, 'autores', 'redaccion.json');
if (!existsSync(REDACCION_PATH)) {
  writeFileSync(
    REDACCION_PATH,
    JSON.stringify(
      {
        nombre: 'Redacción',
        biografia:
          'Autoría colectiva asignada durante la migración del archivo histórico de la revista — la atribución real de cada pieza queda en el propio texto.',
      },
      null,
      2
    ) + '\n',
    'utf-8'
  );
}

// =================================================================================
// Fase E — Entradas
// =================================================================================
const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

ensureDir(join(OUT_DIR, 'entradas'));

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ');
}

function buildExtracto(plainText) {
  const collapsed = decodeEntities(plainText).replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 200) return collapsed;
  const cut = collapsed.slice(0, 200);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : 200)}…`;
}

for (const post of posts) {
  const slug = text(post['wp:post_name']).trim();
  const tituloRaw = decodeEntities(text(post.title)).trim();

  if (!slug || !tituloRaw) {
    report.postsOmitidos.push(`(sin slug/título) "${tituloRaw || '?'}"`);
    continue;
  }

  const fecha = (() => {
    const pubDate = text(post.pubDate);
    return pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '2026-01-01';
  })();

  // Categoría: primero se busca entre las categorías "reales" (domain=category),
  // resolviendo cada nicename a su categoría final vía CATEGORY_ALIAS (cubre tanto
  // las categorías tal cual como las que se fusionaron a una padre). Si el post no
  // tiene NINGUNA categoría real — la mayoría del archivo real, ver investigación—,
  // se cae a buscar entre sus post_tag en el orden de TAG_FALLBACK_PRIORITY.
  const todasLasCategoriasWp = toArray(post.category);
  const categoriasReales = todasLasCategoriasWp.filter((c) => c?.['@_domain'] === 'category');
  const categoriaResueltas = categoriasReales
    .map((c) => CATEGORY_ALIAS[c['@_nicename']])
    .filter(Boolean);
  let categoriaSlug = categoriaResueltas.find((s) => s !== 'sin-categoria') ?? categoriaResueltas[0];

  if (!categoriaSlug) {
    const tagsPost = new Set(
      todasLasCategoriasWp
        .filter((c) => c?.['@_domain'] === 'post_tag')
        .map((c) => CATEGORY_ALIAS[c['@_nicename']])
        .filter(Boolean)
    );
    categoriaSlug = TAG_FALLBACK_PRIORITY.find((slug) => tagsPost.has(slug));
    if (categoriaSlug) {
      report.categoriasPorTag.push(`${slug}: sin categoría real, resuelta por tag a "${categoriaSlug}"`);
    }
  }

  categoriaSlug = categoriaSlug ?? 'sin-categoria';

  if (categoriasReales.length > 1) {
    report.categoriasDescartadas.push(
      `${slug}: se descartaron [${categoriasReales
        .map((c) => c['@_nicename'])
        .filter((n) => CATEGORY_ALIAS[n] !== categoriaSlug)
        .join(', ')}], se dejó "${categoriaSlug}"`
    );
  }

  const numeroSlug = postSlugToNumero.get(slug) ?? 'sin-numero';
  if (numeroSlug === 'sin-numero') {
    report.postsSinNumero.push(slug);
  }

  // Imagen destacada vía _thumbnail_id.
  const postmeta = toArray(post['wp:postmeta']);
  const thumbnailMeta = postmeta.find((m) => text(m['wp:meta_key']) === '_thumbnail_id');
  const thumbnailId = thumbnailMeta ? text(thumbnailMeta['wp:meta_value']) : null;
  const portadaUrl = thumbnailId ? attachmentsById.get(thumbnailId) : null;

  let contenidoHtml = text(post['content:encoded']);
  // Quitar comentarios de bloque de Gutenberg.
  contenidoHtml = contenidoHtml.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '');

  // Imágenes inline del cuerpo (orden de aparición, sin duplicados).
  const inlineUrls = [];
  const seenUrls = new Set();
  const imgRe = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRe.exec(contenidoHtml)) !== null) {
    if (!seenUrls.has(imgMatch[1])) {
      seenUrls.add(imgMatch[1]);
      inlineUrls.push(imgMatch[1]);
    }
  }

  let portadaPath = null;
  if (portadaUrl) {
    portadaPath = `/images/entradas/${slug}/portada.${extFromUrl(portadaUrl)}`;
    report.imageManifest.push({ slug, tipo: 'portada', url: portadaUrl, rutaLocal: portadaPath });
  }

  const galeria = [];
  for (const url of inlineUrls) {
    const isPortada = portadaUrl && url === portadaUrl;
    const localPath = isPortada
      ? portadaPath
      : `/images/entradas/${slug}/${basenameFromUrl(url)}`;
    // Reescribe el <img> del cuerpo para que apunte a la ruta local.
    contenidoHtml = contenidoHtml.split(url).join(localPath);
    if (!isPortada) {
      galeria.push(localPath);
      report.imageManifest.push({ slug, tipo: 'galeria', url, rutaLocal: localPath });
    }
  }

  const extracto = buildExtracto(stripTags(contenidoHtml));
  let cuerpoMarkdown = turndownService.turndown(contenidoHtml).trim();
  // Notas al pie estilo Word ("...texto![6](#_ftn6)"): el "!" final de una oración
  // seguido de un link de nota al pie que turndown genera a continuación arma sin
  // querer una sintaxis de imagen ("![6](#_ftn6)"), que Markdoc intenta resolver como
  // archivo y rompe el build. Se re-escapa el "!" en cualquier "![...](...)" cuya URL
  // no sea una imagen local real nuestra (todas empiezan con /images/).
  cuerpoMarkdown = cuerpoMarkdown.replace(
    /!(\[(?:\\.|[^\]\\])*\]\((?!\/images\/)[^)]*\))/g,
    '\\!$1'
  );

  const frontmatterLines = [
    `titulo: ${yamlQuoted(tituloRaw)}`,
    `fecha: ${fecha}`,
    `numero: ${numeroSlug}`,
    `autor: redaccion`,
    `categoria: ${categoriaSlug}`,
  ];
  if (portadaPath) frontmatterLines.push(`portada: ${yamlQuoted(portadaPath)}`);
  if (galeria.length > 0) {
    frontmatterLines.push('galeria:');
    for (const g of galeria) frontmatterLines.push(`  - ${yamlQuoted(g)}`);
  } else {
    frontmatterLines.push('galeria: []');
  }
  frontmatterLines.push(`extracto: ${yamlQuoted(extracto)}`);

  const fileContent = `---\n${frontmatterLines.join('\n')}\n---\n\n${cuerpoMarkdown}\n`;
  const outPath = join(OUT_DIR, 'entradas', `${slug}.mdoc`);

  if (writeIfAbsent(outPath, fileContent, report, 'entrada')) {
    report.postsProcesados += 1;
  }
}

// =================================================================================
// Fase F — Manifiesto de imágenes y reporte
// =================================================================================
ensureDir(REPORT_DIR);

const csvHeader = 'entrada_slug,tipo,url_original,ruta_local\n';
const csvRows = report.imageManifest
  .map((row) => [row.slug, row.tipo, row.url, row.rutaLocal].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
  .join('\n');
writeFileSync(join(REPORT_DIR, 'images-manifest.csv'), csvHeader + csvRows + '\n', 'utf-8');

const reportMd = `# Reporte de migración WordPress → Keystatic

Generado: ${new Date().toISOString()}

## Resumen

- Posts procesados: ${report.postsProcesados}
- Posts omitidos (sin slug/título): ${report.postsOmitidos.length}
- Categorías creadas: ${report.categoriasCreadas.length}
- Números creados: ${report.numerosCreados.length}
- Posts asignados a "Sin número" (revisar manualmente): ${report.postsSinNumero.length}
- Posts con categorías múltiples (se descartó todo menos una): ${report.categoriasDescartadas.length}
- Posts sin categoría real, resueltos por tag: ${report.categoriasPorTag.length}
- Archivos existentes no sobreescritos: ${report.skipped.length}

## Posts en "Sin número" — reasignar a mano en Keystatic

${report.postsSinNumero.map((s) => `- ${s}`).join('\n') || '(ninguno)'}

## Categorías múltiples descartadas

${report.categoriasDescartadas.map((s) => `- ${s}`).join('\n') || '(ninguna)'}

## Categorías resueltas por tag (sin categoría real en WordPress)

${report.categoriasPorTag.map((s) => `- ${s}`).join('\n') || '(ninguna)'}

## Posts omitidos

${report.postsOmitidos.map((s) => `- ${s}`).join('\n') || '(ninguno)'}

## Archivos ya existentes (no se tocaron, usar --force para sobreescribir)

${report.skipped.map((s) => `- ${s}`).join('\n') || '(ninguno)'}

## Imágenes

Ver \`images-manifest.csv\` en esta misma carpeta — una fila por cada imagen que el
contenido migrado espera encontrar en \`public/\`. Ninguna imagen se descargó
automáticamente (a pedido explícito): hay que copiar cada archivo real a la
\`ruta_local\` indicada, usando \`url_original\` para saber cuál es.
`;
writeFileSync(join(REPORT_DIR, 'report.md'), reportMd, 'utf-8');

console.log('\nListo.');
console.log(`Entradas escritas: ${report.postsProcesados}`);
console.log(`Reporte: ${join(REPORT_DIR, 'report.md')}`);
console.log(`Manifiesto de imágenes: ${join(REPORT_DIR, 'images-manifest.csv')}`);

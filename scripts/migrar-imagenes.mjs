// Carga masiva de las imágenes de las entradas desde el WordPress viejo.
//
//   node scripts/migrar-imagenes.mjs descargar [--dry-run] [--staging <dir>] [--concurrencia=6]
//   node scripts/migrar-imagenes.mjs optimizar [--staging <dir>]
//   node scripts/migrar-imagenes.mjs instalar  [--dry-run] [--staging <dir>]
//
// POR QUÉ EXISTE: cuando se migró el contenido de WordPress no vinieron los binarios, así
// que scripts/imagenes-pendientes.mjs `quitar` sacó del contenido las 2.243 referencias
// cuyo archivo no estaba (una referencia a un archivo inexistente hace que Keystatic lea
// el campo vacío y pierda la referencia al guardar) y las guardó, con su posición exacta,
// en scripts/imagenes-pendientes.json. Cargarlas a mano desde el panel son ~321 guardados
// = ~321 commits = ~321 builds, con 1 build concurrente en el plan gratuito.
//
// DE DÓNDE SALE LA INFORMACIÓN, que ya estaba toda en el repositorio:
//   - la POSICIÓN de cada imagen: scripts/imagenes-pendientes.json (portada con su línea
//     YAML verbatim, cada ítem de galeria/imagenesIndividuales con su índice, y cada imagen
//     del cuerpo con un ancla de 80 caracteres del párrafo anterior y su ocurrencia).
//   - la URL de cada archivo: scripts/migration-report/images-manifest.csv, que generó
//     scripts/migrate-wordpress.mjs al leer el WXR.
//   - los archivos: el WordPress viejo sigue sirviéndolos (el DNS todavía no cambió).
// El cruce es exacto, sin heurística: el campo `ruta_local` del CSV tiene la misma forma
// (/images/entradas/<slug>/<archivo>) que el campo `ruta` del manifiesto. Medido: las
// 2.243 referencias resuelven a una URL, 0 huecos. Son 1.275 archivos distintos, porque
// una misma imagen suele estar repetida como portada, en la galería y en el cuerpo.
//
// TRES PASOS, Y EL DEL MEDIO ES UN PUNTO DE DECISIÓN. `descargar` deja todo en una carpeta
// de staging FUERA del repositorio, a propósito: son ~255 MB de originales y el historial
// de git no los libera nunca, así que primero se mide cuánto queda después de optimizar y
// recién entonces se decide si eso entra en el repositorio o si conviene mover las
// imágenes a R2 (ver docs/imagenes-y-cms.md). `instalar` es el único paso que escribe
// dentro del repositorio.
//
// `instalar` NO reimplementa la colocación: copia los archivos y después llama a
// scripts/imagenes-pendientes.mjs `restaurar`, que es quien sabe volver a poner cada
// referencia donde estaba.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSV = path.join(root, 'scripts', 'migration-report', 'images-manifest.csv');
const MANIFIESTO = path.join(root, 'scripts', 'imagenes-pendientes.json');
const REPORTE = path.join(root, 'scripts', 'migration-report', 'descarga-imagenes.json');

const [modo, ...resto] = process.argv.slice(2);
const dryRun = resto.includes('--dry-run');
const valor = (nombre, porDefecto) => {
  const i = resto.indexOf(`--${nombre}`);
  if (i !== -1 && resto[i + 1] && !resto[i + 1].startsWith('--')) return resto[i + 1];
  const igual = resto.find((a) => a.startsWith(`--${nombre}=`));
  return igual ? igual.split('=').slice(1).join('=') : porDefecto;
};

/* Staging con nombre fijo (no un temporal aleatorio) para que `descargar` sea reanudable
   entre corridas: 1.275 descargas de red se cortan, y volver a empezar de cero es tirar
   trabajo. Fuera del repositorio para que la medición no deje nada en el historial. */
const STAGING = path.resolve(valor('staging', path.join(os.tmpdir(), 'lam-imagenes-staging')));
const CONCURRENCIA = Number(valor('concurrencia', '6'));

if (!['descargar', 'optimizar', 'instalar'].includes(modo)) {
  console.error('Uso: node scripts/migrar-imagenes.mjs <descargar|optimizar|instalar> [--dry-run] [--staging <dir>]');
  process.exit(1);
}

const kb = (b) => (b / 1024).toFixed(0) + ' KB';
const mb = (b) => (b / 1048576).toFixed(1) + ' MB';

// --- CSV --------------------------------------------------------------------------
/* Parser propio en vez de una dependencia: el archivo lo genera migrate-wordpress.mjs con
   todos los campos entre comillas, pero las URLs llevan comas (…?s=1,2) y partir por coma
   a secas las rompe. */
function leerCsv(texto) {
  const filas = [];
  let campo = '';
  let fila = [];
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') enComillas = false;
      else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else if (c !== '\r') campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  const cabecera = filas.shift();
  return filas
    .filter((f) => f.length === cabecera.length && f.some((x) => x !== ''))
    .map((f) => Object.fromEntries(cabecera.map((k, j) => [k, f[j]])));
}

/** Un archivo por descargar: ruta pública -> URL. Deduplicado, porque la misma imagen
    aparece en el CSV una vez por rol (portada / galería / cuerpo). */
function archivosDelCsv() {
  const porRuta = new Map();
  for (const fila of leerCsv(fs.readFileSync(CSV, 'utf8'))) {
    const ruta = fila.ruta_local;
    // El CSV guarda las URLs tal como estaban en el HTML de WordPress, con las entidades
    // sin resolver: sin esto, la de gstatic (…&amp;usqp=CAU) devuelve 404.
    const url = (fila.url_original ?? '').replace(/&amp;/g, '&');
    if (!ruta || !url) continue;
    if (!porRuta.has(ruta)) porRuta.set(ruta, { ruta, url, slug: fila.entrada_slug, tipos: new Set() });
    porRuta.get(ruta).tipos.add(fila.tipo);
  }
  return [...porRuta.values()];
}

/** Las rutas que el manifiesto de pendientes todavía espera. */
function rutasPendientes() {
  const man = JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8'));
  const rutas = new Set();
  for (const e of Object.values(man.entradas ?? {})) {
    if (e.portada) rutas.add(e.portada.ruta);
    for (const items of Object.values(e.listas ?? {})) for (const it of items) rutas.add(it.ruta);
    for (const it of e.cuerpo ?? []) rutas.add(it.ruta);
  }
  return rutas;
}

const aSistema = (ruta) => ruta.replace(/^\//, '').split('/').join(path.sep);
const destinoStaging = (ruta) => path.join(STAGING, aSistema(ruta));
const destinoPublic = (ruta) => path.join(root, 'public', aSistema(ruta));

const EXT_DE_TIPO = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/* EL SITIO VIVE EN DOS DOMINIOS Y NO SIRVEN LO MISMO. El CSV mezcla URLs de
   laantorchamagacin.com y de laantorchamagacin.wordpress.com, y hay archivos que dan 404
   en uno y 200 en el otro con la misma ruta (medido: 2 de los 3 fallos de la primera
   corrida se recuperan así). Ante un 404 se reintenta la misma ruta en el otro dominio. */
const ESPEJOS = [
  ['//laantorchamagacin.com/', '//laantorchamagacin.wordpress.com/'],
  ['//laantorchamagacin.wordpress.com/', '//laantorchamagacin.com/'],
];
const urlEspejo = (url) => {
  for (const [de, a] of ESPEJOS) if (url.includes(de)) return url.replace(de, a);
  return null;
};

// --- descargar ---------------------------------------------------------------------
async function descargar() {
  const archivos = archivosDelCsv();
  const enCsv = new Set(archivos.map((a) => a.ruta));
  const pendientes = rutasPendientes();
  const sinUrl = [...pendientes].filter((r) => !enCsv.has(r));

  console.log(`Archivos distintos en el CSV: ${archivos.length}`);
  console.log(`Referencias que el manifiesto espera: ${pendientes.size}`);
  console.log(`Referencias sin URL conocida: ${sinUrl.length}`);
  for (const r of sinUrl.slice(0, 10)) console.log('  - ' + r);
  console.log(`Staging: ${STAGING}`);

  if (dryRun) {
    const yaEstan = archivos.filter((a) => fs.existsSync(destinoStaging(a.ruta))).length;
    console.log(`\nYa descargados en el staging: ${yaEstan}`);
    console.log(`Se descargarían: ${archivos.length - yaEstan}`);
    console.log('\nInforme solamente. Para aplicarlo: node scripts/migrar-imagenes.mjs descargar');
    return 0;
  }

  const registros = [];
  let i = 0;
  let hechos = 0;
  const total = archivos.length;

  const trabajar = async () => {
    while (i < total) {
      const a = archivos[i++];
      const n = i;
      /* Las dos rutas sin extensión del CSV vienen de URLs de CDN que no terminan en un
         nombre de archivo (…/resize/540/540?… -> "540"). Un archivo sin extensión no sirve:
         ni sharp lo reconoce por el nombre ni el navegador recibe un Content-Type útil. Se
         resuelve con el Content-Type real de la respuesta, y después `instalar` corrige la
         referencia en el manifiesto. */
      const faltaExt = !path.extname(a.ruta);
      let destino = destinoStaging(a.ruta);

      if (!faltaExt && fs.existsSync(destino) && fs.statSync(destino).size > 0) {
        registros.push({
          slug: a.slug,
          ruta: a.ruta,
          url: a.url,
          tipos: [...a.tipos],
          estado: 'ya-estaba',
          bytes: fs.statSync(destino).size,
        });
        continue;
      }

      let reg = { slug: a.slug, ruta: a.ruta, url: a.url, tipos: [...a.tipos] };
      let ultimoError = null;
      let urlUsada = a.url;
      // Las dos entradas de ESPEJOS son simétricas, así que sin esto el espejo del espejo
      // sería la URL original y el bucle no terminaría nunca.
      const probadas = new Set([a.url]);
      let intento = 0;
      while (++intento <= 3) {
        try {
          const r = await fetch(urlUsada, {
            redirect: 'follow',
            // Varios de los CDN ajenos rechazan un cliente sin User-Agent de navegador.
            headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
          });
          if (!r.ok) {
            reg = { ...reg, estado: String(r.status), bytes: 0 };
            if (r.status === 404 || r.status === 410) {
              // Un 404 no se reintenta en el mismo dominio, pero sí una vez en el espejo.
              const espejo = urlEspejo(urlUsada);
              if (espejo && !probadas.has(espejo)) {
                probadas.add(espejo);
                urlUsada = espejo;
                intento = 0;
                ultimoError = null;
                continue;
              }
              ultimoError = null;
              break;
            }
            ultimoError = `HTTP ${r.status}`;
            if (intento < 3) {
              await new Promise((s) => setTimeout(s, 800 * intento));
              continue;
            }
            break;
          }
          const contentType = (r.headers.get('content-type') ?? '').split(';')[0].trim();
          const buf = Buffer.from(await r.arrayBuffer());
          let rutaFinal = a.ruta;
          if (faltaExt) {
            rutaFinal = a.ruta + (EXT_DE_TIPO[contentType] ?? '.jpg');
            destino = destinoStaging(rutaFinal);
          }
          fs.mkdirSync(path.dirname(destino), { recursive: true });
          fs.writeFileSync(destino, buf);
          reg = {
            ...reg,
            estado: 'ok',
            bytes: buf.length,
            contentType,
            ...(urlUsada !== a.url ? { urlEspejo: urlUsada } : {}),
            ...(rutaFinal !== a.ruta ? { rutaCorregida: rutaFinal } : {}),
          };
          ultimoError = null;
          break;
        } catch (e) {
          ultimoError = e.message.split('\n')[0];
          if (intento < 3) await new Promise((s) => setTimeout(s, 800 * intento));
        }
      }
      if (ultimoError) reg = { ...reg, estado: 'error', error: ultimoError, bytes: 0 };
      registros.push(reg);
      hechos++;
      if (hechos % 50 === 0 || n === total) {
        const ok = registros.filter((x) => x.estado === 'ok').length;
        const peso = registros.reduce((s, x) => s + (x.bytes || 0), 0);
        console.log(`  ${n}/${total} · ${ok} descargadas · ${mb(peso)}`);
      }
    }
  };

  console.log('');
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCIA) }, trabajar));

  const ok = registros.filter((r) => r.estado === 'ok');
  const yaEstaban = registros.filter((r) => r.estado === 'ya-estaba');
  const fallos = registros.filter((r) => r.estado !== 'ok' && r.estado !== 'ya-estaba');
  const peso = registros.reduce((s, r) => s + (r.bytes || 0), 0);

  fs.mkdirSync(path.dirname(REPORTE), { recursive: true });
  fs.writeFileSync(
    REPORTE,
    JSON.stringify(
      { generado: new Date().toISOString().slice(0, 10), staging: STAGING, archivos: registros },
      null,
      2
    ) + '\n'
  );

  console.log(`\nDescargadas: ${ok.length} · ya estaban: ${yaEstaban.length} · fallos: ${fallos.length}`);
  console.log(`Peso de los originales: ${mb(peso)}`);
  if (fallos.length) {
    console.log(`\nNo se pudieron descargar (${fallos.length})`);
    for (const f of fallos.slice(0, 20)) console.log(`  - [${f.estado}] ${f.ruta}\n      ${f.url}`);
    if (fallos.length > 20) console.log(`  … y ${fallos.length - 20} más`);
  }
  console.log(`\nReporte: ${path.relative(root, REPORTE).replace(/\\/g, '/')}`);
  console.log('Sigue: node scripts/migrar-imagenes.mjs optimizar');
  return 0;
}

// --- optimizar ---------------------------------------------------------------------
function caminar(dir) {
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) => (e.isDirectory() ? caminar(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    : [];
}

async function optimizar() {
  const raiz = path.join(STAGING, 'images');
  if (!fs.existsSync(raiz)) {
    console.error(`No hay nada en ${raiz}. Corre primero: node scripts/migrar-imagenes.mjs descargar`);
    return 1;
  }
  console.log(`Optimizando el staging con scripts/optimizar-imagenes.mjs (--raiz ${raiz})\n`);
  const r = spawnSync(
    process.execPath,
    [path.join(root, 'scripts', 'optimizar-imagenes.mjs'), '--escribir', `--raiz=${raiz}`],
    { stdio: 'inherit' }
  );

  // --- reporte de decisión: esto es exactamente lo que entraría al repositorio ---
  const { default: sharp } = await import('sharp');
  const LADO_MAX = 1600;
  const PESO_MAX_KB = 250;
  const archivos = caminar(raiz).filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f));
  const rel = (f) => path.relative(raiz, f).replace(/\\/g, '/');
  let peso = 0;
  const sobrePeso = [];
  const sobreLado = [];
  for (const f of archivos) {
    const bytes = fs.statSync(f).size;
    peso += bytes;
    if (bytes / 1024 > PESO_MAX_KB) sobrePeso.push({ rel: rel(f), bytes });
    try {
      const m = await sharp(f).metadata();
      const lado = Math.max(m.width ?? 0, m.height ?? 0);
      if (lado > LADO_MAX) sobreLado.push({ rel: rel(f), lado });
    } catch {
      /* el optimizador ya lo reporta */
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log('PUNTO DE DECISIÓN: esto es lo que entraría al repositorio');
  console.log('─'.repeat(70));
  console.log(`Archivos: ${archivos.length}`);
  console.log(`Peso total: ${mb(peso)}`);
  console.log(`Por encima de ${PESO_MAX_KB} KB (el paso 6 de verificar-keystatic.mjs los rechaza): ${sobrePeso.length}`);
  console.log(`Por encima de ${LADO_MAX} px de lado: ${sobreLado.length}`);
  const top = archivos
    .map((f) => ({ rel: rel(f), bytes: fs.statSync(f).size }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);
  console.log('\nLos 10 más pesados:');
  for (const t of top) console.log(`  - ${kb(t.bytes)}  ${t.rel}`);
  if (sobrePeso.length || sobreLado.length) {
    console.log('\nHay que resolver estos antes de instalar: o se recortan/reemplazan a mano,');
    console.log('o se anotan con su motivo en scripts/imagenes-grandes-aceptadas.json.');
    for (const s of sobrePeso.slice(0, 15)) console.log(`  - ${kb(s.bytes)}  ${s.rel}`);
  }
  console.log('\nCon este número se decide: ¿entra al repositorio, o conviene R2 primero');
  console.log('(docs/imagenes-y-cms.md)? Si entra: node scripts/migrar-imagenes.mjs instalar');
  return r.status ?? 0;
}

// --- instalar ----------------------------------------------------------------------
/** Aplica al manifiesto las rutas que `descargar` tuvo que corregir (las que venían sin
    extensión) y descarta las que ya no existen en el origen. La ruta aparece en tres
    lugares de cada registro — `ruta`, la línea YAML verbatim y las líneas del ítem de
    lista — y hay que cambiarla en todos o `restaurar` escribiría una referencia rota. */
function corregirManifiesto(man, correcciones, descartes) {
  let cambios = 0;
  let quitados = 0;
  const sustituir = (obj, viejo, nuevo) => {
    if (obj.ruta === viejo) {
      obj.ruta = nuevo;
      cambios++;
    }
    if (typeof obj.linea === 'string') obj.linea = obj.linea.split(viejo).join(nuevo);
    if (Array.isArray(obj.lineas)) obj.lineas = obj.lineas.map((l) => l.split(viejo).join(nuevo));
  };
  for (const e of Object.values(man.entradas ?? {})) {
    const todos = [
      ...(e.portada
        ? [
            {
              obj: e.portada,
              quitar: () => {
                e.portada = null;
              },
            },
          ]
        : []),
      ...Object.entries(e.listas ?? {}).flatMap(([clave, items]) =>
        items.map((it) => ({
          obj: it,
          quitar: () => {
            e.listas[clave] = e.listas[clave].filter((x) => x !== it);
          },
        }))
      ),
      ...(e.cuerpo ?? []).map((it) => ({
        obj: it,
        quitar: () => {
          e.cuerpo = e.cuerpo.filter((x) => x !== it);
        },
      })),
    ];
    for (const { obj, quitar } of todos) {
      if (descartes.has(obj.ruta)) {
        quitar();
        quitados++;
        continue;
      }
      const nueva = correcciones.get(obj.ruta);
      if (nueva) sustituir(obj, obj.ruta, nueva);
    }
  }
  return { cambios, quitados };
}

function instalar() {
  if (!fs.existsSync(REPORTE)) {
    console.error('Falta el reporte de descarga. Corre primero: node scripts/migrar-imagenes.mjs descargar');
    return 1;
  }
  const reporte = JSON.parse(fs.readFileSync(REPORTE, 'utf8'));
  const ok = reporte.archivos.filter((a) => a.estado === 'ok' || a.estado === 'ya-estaba');
  const fallados = reporte.archivos.filter((a) => a.estado !== 'ok' && a.estado !== 'ya-estaba');

  const correcciones = new Map(ok.filter((a) => a.rutaCorregida).map((a) => [a.ruta, a.rutaCorregida]));
  const descartes = new Set(fallados.map((a) => a.ruta));

  // 1. Copiar los archivos del staging a public/, sin pisar lo que ya haya.
  const copiados = [];
  const pisarian = [];
  const faltantes = [];
  for (const a of ok) {
    const ruta = a.rutaCorregida ?? a.ruta;
    const origen = destinoStaging(ruta);
    const destino = destinoPublic(ruta);
    if (!fs.existsSync(origen)) {
      faltantes.push(ruta);
      continue;
    }
    if (fs.existsSync(destino)) {
      pisarian.push(ruta);
      continue;
    }
    if (!dryRun) {
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.copyFileSync(origen, destino);
    }
    copiados.push(ruta);
  }

  console.log(`Archivos ${dryRun ? 'por copiar' : 'copiados'} a public/: ${copiados.length}`);
  if (pisarian.length) {
    console.log(`\nYa existían en public/ y NO se tocaron (${pisarian.length}):`);
    for (const p of pisarian.slice(0, 15)) console.log('  - ' + p);
    if (pisarian.length > 15) console.log(`  … y ${pisarian.length - 15} más`);
  }
  if (faltantes.length) {
    console.log(`\nEstaban en el reporte pero no en el staging (${faltantes.length}). Volvé a correr descargar.`);
  }

  // 2. Corregir el manifiesto (rutas sin extensión, referencias muertas).
  const man = JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8'));
  const { cambios, quitados } = corregirManifiesto(man, correcciones, descartes);
  console.log(`\nRutas corregidas en el manifiesto: ${correcciones.size} (en ${cambios} registro(s))`);
  for (const [v, n] of correcciones) console.log(`  - ${v} -> ${n}`);
  console.log(`Rutas descartadas por no existir más en el origen: ${descartes.size} (${quitados} referencia(s))`);
  for (const d of descartes) console.log(`  - ${d}`);
  if (!dryRun && (cambios || quitados)) fs.writeFileSync(MANIFIESTO, JSON.stringify(man, null, 2) + '\n');

  // 3. Avisar de las entradas que ya tienen imágenes cargadas a mano: si `restaurar` les
  //    suma las originales encima quedan duplicadas, y para eso está `descartar`.
  /* Solo avisa de los slugs que TODAVÍA tienen referencias pendientes: si una entrada ya
     se cargó entera a mano, el manifiesto no le guarda nada y `restaurar` no le va a sumar
     nada, así que avisar ahí sería pedir un `descartar` innecesario (y confuso). */
  const conPendientes = new Set(
    Object.entries(man.entradas ?? {})
      .filter(([, e]) => e.portada || (e.cuerpo ?? []).length || Object.values(e.listas ?? {}).some((l) => l.length))
      .map(([slug]) => slug)
  );
  const aMano = [...new Set(pisarian.map((r) => r.split('/')[3]))].filter((s) => s && conPendientes.has(s));
  if (aMano.length) {
    console.log(`\nATENCIÓN: ${aMano.length} entrada(s) ya tenían imágenes en public/.`);
    console.log('Si sus imágenes se subieron a mano desde Keystatic, descartalas del manifiesto');
    console.log('antes de restaurar, o quedarán duplicadas:');
    console.log(`  node scripts/imagenes-pendientes.mjs descartar ${aMano.join(' ')}`);
  }

  if (dryRun) {
    console.log('\nInforme solamente. Para aplicarlo: node scripts/migrar-imagenes.mjs instalar');
    return 0;
  }

  // 4. Restaurar: imagenes-pendientes.mjs sabe volver a poner cada referencia en su sitio.
  console.log('\n' + '─'.repeat(70));
  console.log('node scripts/imagenes-pendientes.mjs restaurar');
  console.log('─'.repeat(70));
  const r = spawnSync(
    process.execPath,
    [path.join(root, 'scripts', 'imagenes-pendientes.mjs'), 'restaurar'],
    { stdio: 'inherit' }
  );
  console.log('\nComprueba ahora: npm run build && node scripts/verificar-keystatic.mjs');
  return r.status ?? 0;
}

const salida = modo === 'descargar' ? await descargar() : modo === 'optimizar' ? await optimizar() : instalar();
process.exit(salida);

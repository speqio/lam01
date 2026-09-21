// Quita (y luego restaura) las referencias a imágenes cuyo archivo no existe en public/.
//
// Por qué existe: si una entrada apunta a una imagen que no está en el repo, Keystatic la
// lee como campo vacío, al guardar intenta borrar el archivo inexistente (error de GitHub
// "A path was requested for deletion which does not exist") o, peor, guarda el campo vacío
// y se pierde la referencia. Mientras no estén los archivos reales, `quitar` deja el
// contenido consistente (entradas editables) y guarda TODO lo que quitó en
// scripts/imagenes-pendientes.json; `restaurar` lo vuelve a poner cuando el archivo ya existe.
//
// Uso:
//   node scripts/imagenes-pendientes.mjs quitar [--dry-run]
//   node scripts/imagenes-pendientes.mjs restaurar [--dry-run]
//   node scripts/imagenes-pendientes.mjs estado [slug]          (qué sigue pendiente)
//   node scripts/imagenes-pendientes.mjs descartar <slug…> [--dry-run]
//       Saca ítems del manifiesto: usar cuando sus imágenes ya se subieron a mano desde
//       Keystatic, para que `restaurar` no las duplique.
//
// Alcance: entradas (portada, galeria, imagenesIndividuales, imágenes sueltas del cuerpo)
// y autores (foto). Los números NO se tocan aquí (su portada es obligatoria: ver
// scripts/portadas-provisionales.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFIESTO = path.join(root, 'scripts', 'imagenes-pendientes.json');
const DIR_ENTRADAS = path.join(root, 'src', 'content', 'entradas');
const DIR_AUTORES = path.join(root, 'src', 'content', 'autores');
const LISTAS = ['galeria', 'imagenesIndividuales'];
const ANCLA_LARGO = 80;

const [modo, ...resto] = process.argv.slice(2);
const dryRun = resto.includes('--dry-run');
const slugsArg = resto.filter((x) => !x.startsWith('--'));
if (!['quitar', 'restaurar', 'estado', 'descartar'].includes(modo)) {
  console.error(
    'Uso: node scripts/imagenes-pendientes.mjs <quitar|restaurar|estado [slug]|descartar <slug…>> [--dry-run]'
  );
  process.exit(1);
}

const existe = (ruta) => fs.existsSync(path.join(root, 'public', ruta));
const leerManifiesto = () =>
  fs.existsSync(MANIFIESTO) ? JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8')) : { entradas: {}, autores: {} };

// Lee un archivo y devuelve el texto normalizado a \n, más una función para escribirlo
// respetando los finales de línea que tenía (el repo mezcla CRLF y LF).
function abrir(ruta) {
  const crudo = fs.readFileSync(ruta, 'utf8');
  const crlf = crudo.includes('\r\n');
  return {
    texto: crudo.replace(/\r\n/g, '\n'),
    guardar(nuevo) {
      fs.writeFileSync(ruta, crlf ? nuevo.replace(/\n/g, '\r\n') : nuevo);
    },
  };
}

function partirEntrada(texto) {
  const m = texto.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  return { fm: m[1].split('\n'), cuerpo: m[2] };
}

const rutaDeLinea = (linea) => {
  const m = linea.match(/:\s*"?([^"\n]+?)"?\s*$/);
  return m ? m[1] : null;
};

// Valor de "imagen:" de un ítem de lista, sea cual sea su indentación/comillas.
const rutaDeItem = (lineas) => {
  for (const l of lineas) {
    const m = l.match(/imagen:\s*"?([^"\n]+?)"?\s*$/);
    if (m) return m[1];
  }
  return null;
};

// Cuerpo: una imagen suelta es una línea que solo contiene ![alt](ruta).
const RE_IMG = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;
const ancla = (linea) => linea.trim().slice(0, ANCLA_LARGO);

function quitarEnEntrada(slug, texto, registro) {
  const partes = partirEntrada(texto);
  if (!partes) return { texto, cambios: 0 };
  let { fm, cuerpo } = partes;
  let cambios = 0;
  const rec = { portada: null, listas: {}, cuerpo: [] };

  // --- portada ---
  const iP = fm.findIndex((l) => /^portada:/.test(l));
  if (iP >= 0) {
    const ruta = rutaDeLinea(fm[iP]);
    if (ruta && !existe(ruta)) {
      rec.portada = { linea: fm[iP], ruta };
      fm.splice(iP, 1);
      cambios++;
    }
  }

  // --- listas (galeria, imagenesIndividuales) ---
  for (const clave of LISTAS) {
    const i0 = fm.findIndex((l) => l === `${clave}:`);
    if (i0 < 0) continue;
    let i1 = i0 + 1;
    while (i1 < fm.length && /^\s+\S|^\s*$/.test(fm[i1]) && fm[i1] !== '') i1++;
    const bloque = fm.slice(i0 + 1, i1);
    const items = [];
    for (const l of bloque) {
      if (/^\s{2}-\s/.test(l) || /^-\s/.test(l)) items.push([l]);
      else if (items.length) items[items.length - 1].push(l);
    }
    const quitados = [];
    const quedan = [];
    items.forEach((lineas, indice) => {
      const ruta = rutaDeItem(lineas);
      if (ruta && !existe(ruta)) quitados.push({ indice, ruta, lineas });
      else quedan.push(lineas);
    });
    if (!quitados.length) continue;
    rec.listas[clave] = quitados;
    cambios += quitados.length;
    const nuevoBloque = quedan.length ? [`${clave}:`, ...quedan.flat()] : [`${clave}: []`];
    fm.splice(i0, i1 - i0, ...nuevoBloque);
  }

  // --- cuerpo ---
  const lineas = cuerpo.split('\n');
  const salida = [];
  const vistas = new Map(); // ancla -> cuántas veces apareció (para desambiguar)
  let previa = null; // { texto, ocurrencia }
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const m = linea.match(RE_IMG);
    if (m && !existe(m[2])) {
      rec.cuerpo.push({
        ruta: m[2],
        alt: m[1],
        linea,
        ancla: previa ? previa.texto : null,
        ocurrencia: previa ? previa.ocurrencia : 0,
      });
      cambios++;
      // si queda un hueco doble en blanco, se colapsa
      if (salida.length && salida[salida.length - 1] === '' && lineas[i + 1] === '') i++;
      continue;
    }
    salida.push(linea);
    if (linea.trim() !== '') {
      const t = ancla(linea);
      const n = (vistas.get(t) ?? 0) + 1;
      vistas.set(t, n);
      previa = { texto: t, ocurrencia: n };
    }
  }
  cuerpo = salida.join('\n');

  if (!cambios) return { texto, cambios: 0 };
  if (rec.portada || Object.keys(rec.listas).length || rec.cuerpo.length) registro[slug] = rec;
  return { texto: `---\n${fm.join('\n')}\n---\n${cuerpo}`, cambios };
}

function restaurarEnEntrada(slug, texto, rec) {
  const partes = partirEntrada(texto);
  if (!partes) return { texto, hechos: 0, pendientes: rec };
  let { fm, cuerpo } = partes;
  let hechos = 0;
  const pend = { portada: null, listas: {}, cuerpo: [] };

  // portada
  if (rec.portada) {
    if (existe(rec.portada.ruta) && !fm.some((l) => /^portada:/.test(l))) {
      const iCat = fm.findIndex((l) => /^categoria:/.test(l));
      fm.splice(iCat >= 0 ? iCat + 1 : fm.length, 0, rec.portada.linea);
      hechos++;
    } else if (!existe(rec.portada.ruta)) pend.portada = rec.portada;
  }

  // listas
  for (const [clave, quitados] of Object.entries(rec.listas ?? {})) {
    const listos = quitados.filter((q) => existe(q.ruta)).sort((a, b) => a.indice - b.indice);
    const faltan = quitados.filter((q) => !existe(q.ruta));
    if (faltan.length) pend.listas[clave] = faltan;
    if (!listos.length) continue;
    const i0 = fm.findIndex((l) => l === `${clave}:` || l === `${clave}: []`);
    let items = [];
    let i1 = i0 + 1;
    if (i0 >= 0 && fm[i0] === `${clave}:`) {
      while (i1 < fm.length && /^\s+\S/.test(fm[i1])) i1++;
      for (const l of fm.slice(i0 + 1, i1)) {
        if (/^\s{2}-\s/.test(l) || /^-\s/.test(l)) items.push([l]);
        else if (items.length) items[items.length - 1].push(l);
      }
    }
    for (const q of listos) {
      items.splice(Math.min(q.indice, items.length), 0, q.lineas);
      hechos++;
    }
    const bloque = [`${clave}:`, ...items.flat()];
    if (i0 >= 0) fm.splice(i0, i1 - i0, ...bloque);
    else {
      const iExt = fm.findIndex((l) => /^extracto:/.test(l));
      fm.splice(iExt >= 0 ? iExt : fm.length, 0, ...bloque);
    }
  }

  // cuerpo: se agrupan por ancla para conservar el orden original
  const listos = (rec.cuerpo ?? []).filter((c) => existe(c.ruta));
  for (const c of rec.cuerpo ?? []) if (!existe(c.ruta)) pend.cuerpo.push(c);
  if (listos.length) {
    const grupos = new Map();
    for (const c of listos) {
      const k = `${c.ancla}\u0000${c.ocurrencia}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(c);
    }
    let lineas = cuerpo.split('\n');
    for (const grupo of grupos.values()) {
      const { ancla: a, ocurrencia } = grupo[0];
      let pos = -1;
      if (a === null) pos = -1; // estaba al inicio del cuerpo
      else {
        let n = 0;
        for (let i = 0; i < lineas.length; i++) {
          if (lineas[i].trim() !== '' && ancla(lineas[i]) === a && ++n === ocurrencia) {
            pos = i;
            break;
          }
        }
        if (pos < 0) {
          pend.cuerpo.push(...grupo);
          continue;
        }
      }
      const nuevas = grupo.flatMap((c) => ['', c.linea]);
      if (a === null) {
        lineas.splice(0, 0, ...grupo.flatMap((c) => [c.linea, '']));
      } else {
        lineas.splice(pos + 1, 0, ...nuevas);
      }
      hechos += grupo.length;
    }
    cuerpo = lineas.join('\n');
  }

  const vacio = !pend.portada && !Object.keys(pend.listas).length && !pend.cuerpo.length;
  return { texto: `---\n${fm.join('\n')}\n---\n${cuerpo}`, hechos, pendientes: vacio ? null : pend };
}

// --- autores (JSON con foto) ---
function quitarAutor(slug, texto, registro) {
  const j = JSON.parse(texto);
  if (typeof j.foto === 'string' && !existe(j.foto)) {
    registro[slug] = { foto: j.foto };
    delete j.foto;
    return { texto: JSON.stringify(j, null, 2) + (texto.endsWith('\n') ? '\n' : ''), cambios: 1 };
  }
  return { texto, cambios: 0 };
}

function restaurarAutor(slug, texto, rec) {
  if (!existe(rec.foto)) return { texto, hechos: 0, pendientes: rec };
  const j = JSON.parse(texto);
  const orden = { nombre: j.nombre, foto: rec.foto, ...j };
  return { texto: JSON.stringify(orden, null, 2) + (texto.endsWith('\n') ? '\n' : ''), hechos: 1, pendientes: null };
}

// --- ejecución ---
const manifiesto = leerManifiesto();
const resumen = { archivos: 0, referencias: 0 };

if (modo === 'quitar') {
  const nuevos = { entradas: {}, autores: {} };
  for (const f of fs.readdirSync(DIR_ENTRADAS).filter((x) => x.endsWith('.mdoc'))) {
    const slug = f.replace(/\.mdoc$/, '');
    const a = abrir(path.join(DIR_ENTRADAS, f));
    const r = quitarEnEntrada(slug, a.texto, nuevos.entradas);
    if (!r.cambios) continue;
    resumen.archivos++;
    resumen.referencias += r.cambios;
    if (!dryRun) a.guardar(r.texto);
  }
  for (const f of fs.readdirSync(DIR_AUTORES).filter((x) => x.endsWith('.json'))) {
    const slug = f.replace(/\.json$/, '');
    const a = abrir(path.join(DIR_AUTORES, f));
    const r = quitarAutor(slug, a.texto, nuevos.autores);
    if (!r.cambios) continue;
    resumen.archivos++;
    resumen.referencias += r.cambios;
    if (!dryRun) a.guardar(r.texto);
  }
  if (!dryRun) {
    // si ya había manifiesto de una corrida anterior, se conserva lo que aún no se restauró
    const salida = {
      generado: new Date().toISOString().slice(0, 10),
      entradas: { ...manifiesto.entradas, ...nuevos.entradas },
      autores: { ...manifiesto.autores, ...nuevos.autores },
    };
    fs.writeFileSync(MANIFIESTO, JSON.stringify(salida, null, 1) + '\n');
  }
  console.log(`${dryRun ? '[dry-run] ' : ''}Referencias quitadas: ${resumen.referencias} en ${resumen.archivos} archivos.`);
} else if (modo === 'restaurar') {
  const quedan = { generado: manifiesto.generado, entradas: {}, autores: {} };
  let sinColocar = 0;
  for (const [slug, rec] of Object.entries(manifiesto.entradas ?? {})) {
    const ruta = path.join(DIR_ENTRADAS, `${slug}.mdoc`);
    if (!fs.existsSync(ruta)) continue;
    const a = abrir(ruta);
    const r = restaurarEnEntrada(slug, a.texto, rec);
    if (r.hechos) {
      resumen.archivos++;
      resumen.referencias += r.hechos;
      if (!dryRun) a.guardar(r.texto);
    }
    if (r.pendientes) quedan.entradas[slug] = r.pendientes;
  }
  for (const [slug, rec] of Object.entries(manifiesto.autores ?? {})) {
    const ruta = path.join(DIR_AUTORES, `${slug}.json`);
    if (!fs.existsSync(ruta)) continue;
    const a = abrir(ruta);
    const r = restaurarAutor(slug, a.texto, rec);
    if (r.hechos) {
      resumen.archivos++;
      resumen.referencias += r.hechos;
      if (!dryRun) a.guardar(r.texto);
    }
    if (r.pendientes) quedan.autores[slug] = r.pendientes;
  }
  if (!dryRun) fs.writeFileSync(MANIFIESTO, JSON.stringify(quedan, null, 1) + '\n');
  const pend =
    Object.keys(quedan.entradas).length + Object.keys(quedan.autores).length;
  console.log(
    `${dryRun ? '[dry-run] ' : ''}Referencias restauradas: ${resumen.referencias} en ${resumen.archivos} archivos. ` +
      `Ítems que aún esperan imágenes: ${pend}.`
  );
}

// --- estado: qué sigue pendiente ---
if (modo === 'estado') {
  const tipos = { portada: 0, galeria: 0, cuerpo: 0 };
  const contar = (rec) => {
    const t = { portada: rec.portada ? 1 : 0, galeria: 0, cuerpo: (rec.cuerpo ?? []).length };
    for (const l of Object.values(rec.listas ?? {})) t.galeria += l.length;
    return t;
  };
  if (slugsArg.length) {
    for (const slug of slugsArg) {
      const rec = manifiesto.entradas?.[slug];
      const aut = manifiesto.autores?.[slug];
      if (!rec && !aut) {
        console.log(`${slug}: sin imágenes pendientes en el manifiesto.`);
        continue;
      }
      if (aut) console.log(`${slug} (autor): foto pendiente → ${aut.foto}`);
      if (rec) {
        const t = contar(rec);
        console.log(`${slug}: ${t.portada} portada, ${t.galeria} de galería, ${t.cuerpo} en el cuerpo`);
        if (rec.portada) console.log(`  portada: ${rec.portada.ruta}`);
        for (const [clave, l] of Object.entries(rec.listas ?? {})) for (const q of l) console.log(`  ${clave}[${q.indice}]: ${q.ruta}`);
        for (const c of rec.cuerpo ?? []) console.log(`  cuerpo: ${c.ruta}`);
      }
    }
  } else {
    const slugs = Object.keys(manifiesto.entradas ?? {});
    for (const rec of Object.values(manifiesto.entradas ?? {})) {
      const t = contar(rec);
      for (const k of Object.keys(tipos)) tipos[k] += t[k];
    }
    const total = tipos.portada + tipos.galeria + tipos.cuerpo;
    console.log(`Entradas con imágenes pendientes: ${slugs.length}`);
    console.log(`Autores con foto pendiente: ${Object.keys(manifiesto.autores ?? {}).length}`);
    console.log(`Referencias en entradas: ${total} (${tipos.portada} portadas, ${tipos.galeria} de galería, ${tipos.cuerpo} en el cuerpo)`);
    console.log('Detalle de una entrada: node scripts/imagenes-pendientes.mjs estado <slug>');
  }
}

// --- descartar: sacar ítems del manifiesto ---
if (modo === 'descartar') {
  if (!slugsArg.length) {
    console.error('Indica al menos un slug: node scripts/imagenes-pendientes.mjs descartar <slug…>');
    process.exit(1);
  }
  let quitados = 0;
  for (const slug of slugsArg) {
    let hallado = false;
    for (const grupo of ['entradas', 'autores']) {
      if (manifiesto[grupo]?.[slug]) {
        hallado = true;
        quitados++;
        if (!dryRun) delete manifiesto[grupo][slug];
        console.log(`${dryRun ? '[dry-run] ' : ''}${grupo}/${slug}: sale del manifiesto (restaurar ya no le agregará nada).`);
      }
    }
    if (!hallado) console.log(`${slug}: no estaba en el manifiesto.`);
  }
  if (!dryRun && quitados) fs.writeFileSync(MANIFIESTO, JSON.stringify(manifiesto, null, 1) + '\n');
}

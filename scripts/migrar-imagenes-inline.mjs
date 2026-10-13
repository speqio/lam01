// Migra las imágenes sueltas del cuerpo (![](...)) a los campos editables de Keystatic
// (imagenesIndividuales/galeria), asignándoles `posicion`/`galeriaPosicion`, y borra la
// línea duplicada del cuerpo.
//
// Por qué: la mayoría de esas imágenes YA estaban duplicadas en galeria/imagenesIndividuales
// (sin posición, por eso caían al final del artículo) — cada una se renderizaba dos veces:
// una vez como texto plano (no editable desde Keystatic) y otra desde el campo estructurado.
// El reposicionamiento por `posicion` ya existe y corre siempre, no solo en "modo lectura"
// (ver src/views/EntradaPagina.astro, el bloque `especiales.forEach` que mueve cada bloque
// especial al índice de párrafo indicado) — así que no hace falta tocar el layout, solo
// calcular esa posición y quitar el duplicado.
//
// REGLA (decidida con el cliente): se agrupan las imágenes inline por la posición de
// párrafo que comparten (imágenes seguidas, sin texto real entre medio, comparten posición).
// Un grupo de 1 o 2 imágenes en la misma posición → cada una pasa a `imagenesIndividuales`,
// con su propia `posicion`. Un grupo de 3 o más → pasan a `galeria` como un solo carrusel,
// con `galeriaPosicion` — nunca sin posición (ya no se admite que el carrusel caiga al final
// por default). El campo de origen (dónde estaba cada imagen hoy) no importa, la regla de
// arriba decide el campo de destino.
//
// LÍMITE DEL ESQUEMA: `galeria` solo tiene UNA `galeriaPosicion` para todo el array — no se
// pueden representar dos carruseles en posiciones distintas dentro de la misma entrada. Un
// archivo con 2+ grupos de 3+ imágenes en posiciones distintas se deja intacto y se lista
// para revisión manual.
//
// Uso:
//   node scripts/migrar-imagenes-inline.mjs               informe, NO escribe nada
//   node scripts/migrar-imagenes-inline.mjs --escribir     aplica los cambios
//
// Unidad de "posición" = índice (1-based) del último bloque de texto real (párrafo, verso,
// lista, encabezado, divisor) antes de la imagen — NO cuenta las imágenes mismas, porque
// tras la migración ya no van a estar en el cuerpo. En categoría "poesia" cada línea no
// vacía es su propio bloque (verso); en el resto, los bloques se separan por línea en
// blanco, y un divisor siempre corta el grupo.
//
// Los ítems ya posicionados a mano (posicion/galeriaPosicion ya presente) NO se tocan: se
// dejan tal cual, y su imagen inline (si la hay) igual se borra del cuerpo porque ya está
// bien representada.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_ENTRADAS = path.join(root, 'src', 'content', 'entradas');
const LISTAS = ['galeria', 'imagenesIndividuales'];
const UMBRAL_CARRUSEL = 3;

const escribir = process.argv.includes('--escribir');

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

const rutaDeItem = (lineas) => {
  for (const l of lineas) {
    const m = l.match(/imagen:\s*"?([^"\n]+?)"?\s*$/);
    if (m) return m[1];
  }
  return null;
};
const campoDeItem = (lineas, campo) => {
  for (const l of lineas) {
    const m = l.match(new RegExp(`^\\s*${campo}:\\s*(.*)$`));
    if (m) return m[1].trim();
  }
  return undefined;
};

/** Lee el bloque de una lista (galeria/imagenesIndividuales) del frontmatter. Cubre las dos
    formas que Keystatic guarda para una lista vacía/no vacía: "clave: []" en una sola línea,
    o "clave:" seguido de ítems indentados. */
function leerLista(fm, clave) {
  const iVacio = fm.findIndex((l) => l === `${clave}: []`);
  if (iVacio >= 0) return { i0: iVacio, i1: iVacio + 1, items: [] };
  const i0 = fm.findIndex((l) => l === `${clave}:`);
  if (i0 < 0) return null;
  let i1 = i0 + 1;
  while (i1 < fm.length && /^\s+\S|^\s*$/.test(fm[i1]) && fm[i1] !== '') i1++;
  const items = [];
  for (const l of fm.slice(i0 + 1, i1)) {
    if (/^\s{2}-\s/.test(l) || /^-\s/.test(l)) items.push([l]);
    else if (items.length) items[items.length - 1].push(l);
  }
  return { i0, i1, items };
}

const RE_IMG = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;
const esDivisor = (l) => /^(?:\*\s*\*\s*\*|-{3,}|_{3,}|\*{3,})$/.test(l.trim());

function indiceDeBloquePorLinea(lineas, poesia) {
  const indicePrevio = new Array(lineas.length).fill(0);
  let bloqueActual = 0;
  let dentroDeGrupo = false;
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const vacia = linea.trim() === '';
    const esImagen = RE_IMG.test(linea);
    if (vacia) dentroDeGrupo = false;
    else if (esImagen) {
      // no cuenta como bloque de texto.
    } else if (poesia) bloqueActual++;
    else if (esDivisor(linea)) {
      bloqueActual++;
      dentroDeGrupo = false;
    } else if (!dentroDeGrupo) {
      bloqueActual++;
      dentroDeGrupo = true;
    }
    indicePrevio[i] = bloqueActual;
  }
  return indicePrevio;
}

/** Arma la línea "- imagen: ..." (+ alt/leyenda si había) para un ítem nuevo o reubicado,
    con la indentación de 2 espacios estándar del resto del archivo. */
function lineasDeItem(ruta, existente) {
  if (existente) {
    // reindenta por si veía de un bloque con otro estilo de indentación.
    const primera = `  - imagen: ${existente[0].includes('"') ? `"${ruta}"` : ruta}`;
    const resto = existente.slice(1).map((l) => '  ' + l.replace(/^\s+/, ''));
    return [primera, ...resto];
  }
  return [`  - imagen: "${ruta}"`];
}

function conPosicion(lineas, posicion) {
  if (lineas.some((l) => /^\s*posicion:/.test(l))) return lineas; // ya la tenía, no se toca.
  // Keystatic exige posicion >= 1 ("después del párrafo número"); una imagen que estaba
  // antes de cualquier párrafo real no tiene forma válida de expresar "antes de todo", así
  // que se deja sin posicion (cae al final, como ya pasaba antes de migrar).
  if (posicion < 1) return lineas;
  return [...lineas, `    posicion: ${posicion}`];
}

function migrarEntrada(texto, categoria) {
  const partes = partirEntrada(texto);
  if (!partes) return null;
  const { fm, cuerpo } = partes;
  const poesia = categoria === 'poesia';

  const lineas = cuerpo.split('\n');
  const indicePorLinea = indiceDeBloquePorLinea(lineas, poesia);

  const inline = [];
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(RE_IMG);
    if (m) inline.push({ fila: i, ruta: m[2], posicion: indicePorLinea[i] });
  }
  if (!inline.length) return { reporte: { sinImagenes: true } };

  // posición de la PRIMERA ocurrencia de cada ruta manda.
  const posicionDeRuta = new Map();
  const filasPorRuta = new Map();
  for (const img of inline) {
    if (!posicionDeRuta.has(img.ruta)) posicionDeRuta.set(img.ruta, img.posicion);
    if (!filasPorRuta.has(img.ruta)) filasPorRuta.set(img.ruta, []);
    filasPorRuta.get(img.ruta).push(img.fila);
  }

  // listas existentes -> mapa ruta -> {clave, item}
  const listas = {};
  for (const clave of LISTAS) listas[clave] = leerLista(fm, clave) ?? { i0: -1, i1: -1, items: [] };
  const existentePorRuta = new Map();
  for (const clave of LISTAS) {
    for (const item of listas[clave].items) {
      const ruta = rutaDeItem(item);
      if (ruta) existentePorRuta.set(ruta, { clave, item });
    }
  }

  // agrupar por posición compartida (solo las rutas que tienen imagen inline).
  const grupoPorPosicion = new Map();
  for (const [ruta, pos] of posicionDeRuta) {
    if (!grupoPorPosicion.has(pos)) grupoPorPosicion.set(pos, []);
    grupoPorPosicion.get(pos).push(ruta);
  }
  const gruposCarrusel = [...grupoPorPosicion.entries()].filter(([, rutas]) => rutas.length >= UMBRAL_CARRUSEL);

  if (gruposCarrusel.length > 1) {
    return { reporte: { multiCarrusel: true, cantidad: gruposCarrusel.length } };
  }

  const galeriaPosicionYaFijada = fm.some((l) => /^galeriaPosicion:\s*\d/.test(l));

  const rutasYaProcesadas = new Set(); // rutas cuyo ítem YA tenía posicion y se preserva tal cual
  const nuevosIndividuales = [];
  const nuevosGaleria = [];
  let nuevaGaleriaPosicion = null;
  const filasABorrar = new Set();

  for (const [posicion, rutas] of grupoPorPosicion) {
    const esCarrusel = rutas.length >= UMBRAL_CARRUSEL;
    if (esCarrusel) {
      // si ya hay galeriaPosicion fijada a mano, se preserva el campo tal cual (no se
      // mueve nada hacia/desde galeria para este grupo) — solo se borra el texto inline.
      if (galeriaPosicionYaFijada) {
        for (const r of rutas) for (const f of filasPorRuta.get(r)) filasABorrar.add(f);
        continue;
      }
      nuevaGaleriaPosicion = posicion;
      for (const ruta of rutas) {
        const existente = existentePorRuta.get(ruta);
        nuevosGaleria.push(lineasDeItem(ruta, existente?.item));
        for (const f of filasPorRuta.get(ruta)) filasABorrar.add(f);
      }
    } else {
      for (const ruta of rutas) {
        const existente = existentePorRuta.get(ruta);
        if (existente?.clave === 'imagenesIndividuales' && campoDeItem(existente.item, 'posicion') !== undefined) {
          // ya tenía posición asignada a mano: se deja tal cual donde está.
          rutasYaProcesadas.add(ruta);
          for (const f of filasPorRuta.get(ruta)) filasABorrar.add(f);
          continue;
        }
        const lineas2 = conPosicion(lineasDeItem(ruta, existente?.item), posicion);
        nuevosIndividuales.push(lineas2);
        for (const f of filasPorRuta.get(ruta)) filasABorrar.add(f);
      }
    }
  }

  if (!filasABorrar.size) return { reporte: { sinCambios: true } };

  // reconstruir imagenesIndividuales: los ítems NO tocados (sin imagen inline, o ya con
  // posición propia que se preserva) quedan igual; se suman los nuevos al final.
  const rutasMovidas = new Set([...nuevosIndividuales, ...nuevosGaleria].map((l) => rutaDeItem(l)));
  const individualesSinTocar = listas.imagenesIndividuales.items.filter((item) => {
    const r = rutaDeItem(item);
    return !r || (!posicionDeRuta.has(r)) || rutasYaProcesadas.has(r);
  });
  const galeriaSinTocar = listas.galeria.items.filter((item) => {
    const r = rutaDeItem(item);
    if (!r) return true;
    if (!posicionDeRuta.has(r)) return true;
    if (galeriaPosicionYaFijada) return true; // se preserva el array tal cual
    return rutasMovidas.has(r) ? false : true;
  });

  const imagenesIndividualesFinal = [...individualesSinTocar, ...nuevosIndividuales];
  const galeriaFinal = galeriaPosicionYaFijada
    ? listas.galeria.items
    : [...galeriaSinTocar, ...nuevosGaleria];

  // escribir frontmatter: galeria primero (coincide con el orden de keystatic.config.ts),
  // luego galeriaPosicion, luego imagenesIndividuales.
  const fm2 = [...fm];
  const writeLista = (clave, items) => {
    const actual = leerLista(fm2, clave);
    const bloque = items.length ? [`${clave}:`, ...items.flat()] : [`${clave}: []`];
    if (actual) fm2.splice(actual.i0, actual.i1 - actual.i0, ...bloque);
    else {
      const iExt = fm2.findIndex((l) => /^extracto:/.test(l));
      fm2.splice(iExt >= 0 ? iExt : fm2.length, 0, ...bloque);
    }
  };
  writeLista('galeria', galeriaFinal);
  if (nuevaGaleriaPosicion !== null && nuevaGaleriaPosicion >= 1) {
    const actual = leerLista(fm2, 'galeria');
    fm2.splice(actual.i1, 0, `galeriaPosicion: ${nuevaGaleriaPosicion}`);
  }
  writeLista('imagenesIndividuales', imagenesIndividualesFinal);

  // borrar líneas inline, colapsando huecos dobles en blanco.
  const salida = [];
  for (let i = 0; i < lineas.length; i++) {
    if (filasABorrar.has(i)) {
      if (salida.length && salida[salida.length - 1] === '' && lineas[i + 1] === '') i++;
      continue;
    }
    salida.push(lineas[i]);
  }
  const nuevoCuerpo = salida.join('\n');

  return {
    texto: `---\n${fm2.join('\n')}\n---\n${nuevoCuerpo}`,
    reporte: {
      individuales: nuevosIndividuales.length,
      carrusel: nuevosGaleria.length,
      posicionConservada: rutasYaProcesadas.size,
    },
  };
}

const archivos = fs.readdirSync(DIR_ENTRADAS).filter((f) => f.endsWith('.mdoc'));
const totales = { archivos: 0, individuales: 0, carrusel: 0, posicionConservada: 0 };
const multiCarruselEn = [];

for (const f of archivos) {
  const slug = f.replace(/\.mdoc$/, '');
  const a = abrir(path.join(DIR_ENTRADAS, f));
  const mCategoria = a.texto.match(/^categoria:\s*(\S+)/m);
  const categoria = mCategoria ? mCategoria[1] : null;
  const r = migrarEntrada(a.texto, categoria);
  if (!r) continue;
  if (r.reporte.multiCarrusel) {
    multiCarruselEn.push(`${slug} (${r.reporte.cantidad} grupos de ${UMBRAL_CARRUSEL}+)`);
    continue;
  }
  if (!r.texto) continue;
  totales.archivos++;
  totales.individuales += r.reporte.individuales;
  totales.carrusel += r.reporte.carrusel;
  totales.posicionConservada += r.reporte.posicionConservada;
  if (escribir) a.guardar(r.texto);
}

console.log(`${escribir ? '' : '[informe] '}Archivos tocados: ${totales.archivos}`);
console.log(`Imágenes a imagenesIndividuales (1-2 por posición), con posicion nueva: ${totales.individuales}`);
console.log(`Imágenes a galeria (3+ por posición), con galeriaPosicion nueva: ${totales.carrusel}`);
if (totales.posicionConservada) console.log(`Preservadas con su posicion/galeriaPosicion ya asignada a mano: ${totales.posicionConservada}`);
if (multiCarruselEn.length) {
  console.log(`\nArchivos con 2+ carruseles en posiciones distintas (el esquema no lo permite, revisión manual) (${multiCarruselEn.length}):`);
  for (const s of multiCarruselEn) console.log(`  - ${s}`);
}
if (!escribir) console.log('\nInforme solamente. Para aplicar: node scripts/migrar-imagenes-inline.mjs --escribir');

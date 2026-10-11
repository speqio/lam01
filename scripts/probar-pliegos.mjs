// Prueba de la regla de reparto en pliegos, con los altos reales que daría una entrada.
import { repartirEnPliegos, objetivoPorPliego } from '../src/lib/pliegos.ts';

let fallos = 0;
const ok = (cond, msg) => {
  if (!cond) {
    fallos++;
    console.log('  ✖ ' + msg);
  } else {
    console.log('  ok ' + msg);
  }
};

const p = (alto) => ({ alto, especial: false });
const esp = () => ({ alto: 700, especial: true });

const VENTANA = 1080;
const OBJ = objetivoPorPliego(VENTANA); // 1836

console.log(`objetivo por pliego: ${OBJ}px de contenido (= ${OBJ / 2}px por columna de ${VENTANA}px de pantalla)\n`);

console.log('invariantes generales');
{
  // Entrada mediana: ~13 bloques de ~340px (10.100 chars / 13 bloques a 60ch por linea)
  const bloques = Array.from({ length: 13 }, () => p(340));
  const r = repartirEnPliegos(bloques, OBJ);
  const indices = r.flatMap((x) => x.indices);
  ok(indices.length === 13, `no se pierde ni se duplica ningún bloque (${indices.length}/13)`);
  ok(
    indices.every((v, i) => v === i),
    'se conserva el orden original'
  );
  ok(
    r.every((g) => g.indices.reduce((a, i) => a + bloques[i].alto, 0) <= OBJ || g.indices.length === 1),
    'ningún pliego pasa del objetivo salvo que sea un bloque solo'
  );
  const altoPliego = (g) => g.indices.reduce((a, i) => a + bloques[i].alto, 0) / 2;
  ok(
    r.every((g) => altoPliego(g) <= VENTANA),
    `cada pliego entra en una pantalla (altos: ${r.map((g) => Math.round(altoPliego(g))).join(', ')}px)`
  );
  console.log(`     -> ${r.length} pliegos para la entrada mediana`);
}

console.log('\nbloques especiales');
{
  const bloques = [p(300), p(300), esp(), p(300), p(300)];
  const r = repartirEnPliegos(bloques, OBJ);
  const conEsp = r.filter((g) => g.indices.includes(2));
  ok(conEsp.length === 1 && conEsp[0].indices.length === 1, 'el especial queda solo en su pliego');
  ok(conEsp[0].ancho === true, 'y ese pliego es de ancho completo (una columna)');
  ok(r.filter((g) => !g.ancho).every((g) => !g.indices.includes(2)), 'no aparece en ningún pliego de dos columnas');
  ok(
    r.flatMap((g) => g.indices).join(',') === '0,1,2,3,4',
    'el orden se mantiene alrededor del especial'
  );
  ok(r.length === 3, `3 pliegos: texto, especial, texto (hay ${r.length})`);
}

console.log('\ncasos límite');
{
  ok(repartirEnPliegos([], OBJ).length === 0, 'sin bloques, sin pliegos');
  ok(repartirEnPliegos([p(100)], OBJ).length === 1, 'un bloque corto, un pliego');
  const gigante = repartirEnPliegos([p(5000)], OBJ);
  ok(gigante.length === 1 && gigante[0].indices.length === 1, 'un bloque más alto que el objetivo no se parte ni abre un pliego vacío');
  const r2 = repartirEnPliegos([esp(), esp()], OBJ);
  ok(r2.length === 2 && r2.every((g) => g.ancho), 'dos especiales seguidos, dos pliegos anchos y ninguno vacío');
  ok(
    repartirEnPliegos([p(10), esp()], OBJ).length === 2,
    'un especial al final no deja un pliego vacío detrás'
  );
  // La entrada más larga del sitio: 69 bloques
  const larga = Array.from({ length: 69 }, () => p(340));
  const rl = repartirEnPliegos(larga, OBJ);
  ok(rl.flatMap((g) => g.indices).length === 69, 'la entrada más larga reparte sus 69 bloques');
  console.log(`     -> ${rl.length} pliegos para la entrada más larga (52.000 caracteres)`);
}

console.log('\npantallas chicas y grandes');
for (const vp of [800, 1080, 1440]) {
  const obj = objetivoPorPliego(vp);
  const bloques = Array.from({ length: 30 }, () => p(340));
  const r = repartirEnPliegos(bloques, obj);
  const altos = r.map((g) => g.indices.reduce((a, i) => a + bloques[i].alto, 0) / 2);
  const cabe = altos.every((h) => h <= vp);
  if (!cabe) fallos++;
  console.log(`  ${cabe ? 'ok ' : '✖ '} ventana ${vp}px -> ${r.length} pliegos, el más alto ${Math.round(Math.max(...altos))}px`);
}

console.log(fallos ? `\n✖ ${fallos} fallo(s)` : '\n✔ todas las invariantes se cumplen');
process.exit(fallos ? 1 : 0);

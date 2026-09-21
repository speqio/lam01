// Mantiene la rama `keystatic` (guardados del cliente) al día con `main`.
//   node scripts/keystatic-sync.mjs traer-main    -> merge de main en keystatic (sin riesgo)
//   node scripts/keystatic-sync.mjs cerrar-ciclo  -> tras fusionar el PR con squash, deja
//                                                    keystatic igual a main (solo si no hay
//                                                    cambios del cliente sin fusionar)
// Flujo completo: docs/flujo-keystatic.md
import { execFileSync } from 'node:child_process';

const RAMA = 'keystatic';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
const falla = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};

const comando = process.argv[2];
if (!['traer-main', 'cerrar-ciclo'].includes(comando)) {
  falla('Uso: node scripts/keystatic-sync.mjs traer-main | cerrar-ciclo');
}

if (git('status', '--porcelain', '--untracked-files=no')) {
  falla('Hay cambios sin commitear. Haz commit o stash antes de sincronizar.');
}

const rama = git('rev-parse', '--abbrev-ref', 'HEAD');
git('fetch', 'origin');

try {
  git('rev-parse', '--verify', `origin/${RAMA}`);
} catch {
  falla(`No existe origin/${RAMA}.`);
}

try {
  git('checkout', RAMA);
  // Deja la rama local igual a lo último del remoto (el cliente guarda directo en origin).
  git('merge', '--ff-only', `origin/${RAMA}`);

  if (comando === 'traer-main') {
    git('merge', '--no-edit', 'origin/main');
    git('push', 'origin', RAMA);
    console.log('✔ main traído a keystatic.');
  } else {
    // Tras un squash, keystatic tiene commits que main no tiene como antecesores, pero el
    // CONTENIDO (src/content y public/images) debe ser idéntico; el código puede diferir si main avanzó. Si no lo es, el cliente guardó algo que aún no se fusionó.
    const diff = git('diff', '--stat', 'origin/main', `origin/${RAMA}`, '--', 'src/content', 'public/images');
    if (diff) {
      falla(
        `keystatic tiene cambios que main no tiene (guardados sin fusionar). No se reinicia.\n${diff}`
      );
    }
    git('reset', '--hard', 'origin/main');
    git('push', '--force-with-lease', 'origin', RAMA);
    console.log('✔ keystatic reiniciada a main. El cliente debe recargar Keystatic (Ctrl+Shift+R).');
  }
} finally {
  if (rama !== RAMA) git('checkout', rama);
}

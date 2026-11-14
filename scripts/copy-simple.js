'use strict';

/**
 * Copia il connettore negli appunti.
 *
 *   npm run copy
 *
 * Serve quando vuoi portarlo su un altro host (un VPS, un container, un
 * notebook online): lo incolli li' e lo avvii con `node server.js`.
 *
 * Le credenziali NON viengono copiate: restano nel .env, o passi le
 * variabili d'ambiente XTREAM_USERNAME / XTREAM_PASSWORD.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'simple', 'server.js');

function main() {
  const source = TARGET;
  const code = fs.readFileSync(source, 'utf8');

  const clipboard =
    process.platform === 'darwin'
      ? 'pbcopy'
      : process.platform === 'win32'
        ? 'clip'
        : 'xclip -selection clipboard';

  const res = spawnSync(clipboard, [], { input: code, shell: true });

  if (res.status !== 0) {
    console.error('');
    console.error('  Copia non riuscita. Stampa il file e copialo a mano:');
    console.error(`    cat ${path.relative(ROOT, source)}`);
    console.error('');
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log(`  Negli appunti: ${path.relative(ROOT, source)}`);
  console.log(`  ${code.split('\n').length} righe copiate negli appunti.`);
  console.log('');
  console.log('  Adesso:');
  console.log('    1. apri l\'host dove vuoi usarlo');
  console.log('    2. incolla (Cmd+V) il codice');
  console.log('    3. node server.js (con XTREAM_USERNAME e XTREAM_PASSWORD)');
  console.log('');
}

main();

'use strict';

/**
 * Rigenera il logo inline (data URI) dentro simple/server.js
 * a partire da assets/jarvis-logo.svg.
 *
 *   npm run build:logo
 *
 * Perche' esiste: il file singolo deve restare autonomo (nessun file
 * esterno da caricare), ma il logo non deve essere copiato a mano.
 * La fonte resta il file SVG nella cartella assets/.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SVG = path.join(ROOT, 'assets', 'jarvis-logo.svg');
const TARGET = path.join(ROOT, 'simple', 'server.js');

const MARKER = '  logo:\n';

function main() {
  const svg = fs.readFileSync(SVG, 'utf8');
  // Data URI SVG: inline e senza dipendenze.
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');

  let source = fs.readFileSync(TARGET, 'utf8');
  const start = source.indexOf(MARKER);
  if (start === -1) {
    console.error("  Non trovo il campo 'logo:' nel template.");
    process.exitCode = 1;
    return;
  }

  // La riga 'logo:' occupa due righe in giu' (stringa lunga su una riga sola).
  const valueStart = start + MARKER.length;
  const valueEnd = source.indexOf('\n', valueStart);
  const old = source.slice(valueStart, valueEnd);

  const newValue = `    '${uri}',`;
  source = source.slice(0, valueStart) + newValue + source.slice(valueEnd);

  fs.writeFileSync(TARGET, source, 'utf8');
  console.log(`  Logo inline aggiornato (${Math.round(uri.length / 1024)} KB di data URI).`);
  console.log(`  Sorgente: ${path.relative(ROOT, SVG)}`);
  console.log('  Il .env non cambia: riavvia il server.');
}

main();

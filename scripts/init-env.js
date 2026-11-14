'use strict';

/**
 * Prepara la configurazione locale: crea il file .env a partire dal
 * template, con una password generata se non ne hai una.
 *
 *   npm run init
 *
 * Il .env e' in .gitignore: le credenziali restano private.
 * Il file .env non viene MAI modificato se esiste gia'.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, '.env.example');
const TARGET = path.join(ROOT, '.env');

/** Password casuale ma digitabile (niente caratteri ambigui). */
function generatePassword(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function main() {
  if (fs.existsSync(TARGET)) {
    console.log('');
    console.log('  Il file .env c\'e\' gia\': non lo tocco.');
    console.log(`  Per vederlo:  grep XTREAM ${path.relative(ROOT, TARGET)}`);
    console.log('');
    return;
  }

  if (!fs.existsSync(TEMPLATE)) {
    console.error('  .env.example non trovato.');
    process.exitCode = 1;
    return;
  }

  const username = process.env.XTREAM_USERNAME || 'Jarvis_Admin';
  const password = process.env.XTREAM_PASSWORD || generatePassword();

  const content = fs
    .readFileSync(TEMPLATE, 'utf8')
    .replace(/^XTREAM_USERNAME=.*$/m, `XTREAM_USERNAME=${username}`)
    .replace(/^XTREAM_PASSWORD=.*$/m, `XTREAM_PASSWORD=${password}`);

  fs.writeFileSync(TARGET, content, { mode: 0o600 });

  console.log('');
  console.log('  Creato .env con credenziali generate:');
  console.log(`    username: ${username}`);
  console.log(`    password: ${password}`);
  console.log('');
  console.log('  Sono queste le credenziali da mettere in IBO Player Pro.');
  console.log('  Adesso avvia:  npm start');
  console.log('');
}

main();

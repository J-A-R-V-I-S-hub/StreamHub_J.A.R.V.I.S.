'use strict';

/**
 * Genera dist/browser-demo.js: uno script autonomo (nessun require, nessun
 * npm) da incollare nel playground browser.
 *
 *   node scripts/build-browser-demo.js https://xxx.trycloudflare.com
 *
 * Lo script interroga il backend attivo e stampa in console esattamente
 * i JSON che IBO Player Pro riceve, cosi' da vedere il flusso completo
 * prima di andare sulla TV.
 *
 * Le credenziali vengono lette da .env (mai hardcoded nel repository).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const env = require(path.join(ROOT, 'server', 'lib', 'env.js'));
env.loadEnv(ROOT);

const base = (process.argv[2] || 'http://localhost:8080').replace(/\/+$/, '');
const username = process.env.XTREAM_USERNAME || '';
const password = process.env.XTREAM_PASSWORD || '';

if (!username || !password) {
  console.error('Credenziali mancanti: definisci XTREAM_USERNAME / XTREAM_PASSWORD in .env');
  process.exit(1);
}

const outFile = path.join(ROOT, 'dist', 'browser-demo.js');

const script = `/* StreamHub J.A.R.V.I.S. - demo browser (incolla nel playground e premi Run) */
const BASE = ${JSON.stringify(base)};
const AUTH = 'username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}';

const STEPS = [
  ['AUTENTICAZIONE (prima richiesta del player)', ''],
  ['CATEGORIE VOD', '&action=get_vod_categories'],
  ['FILM (VOD)', '&action=get_vod_streams'],
  ['DETTAGLIO FILM (TMDb)', '&action=get_vod_info&vod_id=1001'],
  ['CATEGORIE SERIE', '&action=get_series_categories'],
  ['SERIE', '&action=get_series'],
  ['STAGIONI + EPISODI', '&action=get_series_info&series_id=2001'],
  ['CATEGORIE LIVE', '&action=get_live_categories'],
  ['LIVE', '&action=get_live_streams'],
];

async function run() {
  console.log('%cJ.A.R.V.I.S. - StreamHub', 'color:#F0B429;font-size:16px;font-weight:bold');
  console.log('Server: ' + BASE);
  console.log('--------------------------------------------------');

  for (const [label, query] of STEPS) {
    const url = BASE + '/player_api.php?' + AUTH + query;
    try {
      const res = await fetch(url);
      const json = await res.json();
      console.log('%c' + label, 'color:#6EE7A8;font-weight:bold');
      console.log(JSON.stringify(json, null, 2));
      console.log('--------------------------------------------------');
    } catch (err) {
      console.error('Errore su ' + label + ':', err && err.message);
    }
  }

  console.log('%cGateway flussi (302 verso il file):', 'color:#F0B429;font-weight:bold');
  const g = await fetch(BASE + '/get.php?' + AUTH + '&stream=1101&extension=mp4', { redirect: 'manual' });
  console.log('HTTP ' + g.status + ' -> ' + (g.headers.get('location') || '(nessun redirect)'));
  console.log('%cFatto: apri la TV e inserisci questi dati in IBO Player Pro.', 'color:#F0B429');
}

run();
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, script, 'utf8');
console.log(`Demo browser generata: ${outFile}`);
console.log(`Server puntato: ${base}`);

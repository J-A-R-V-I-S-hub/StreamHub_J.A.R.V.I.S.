/*!
 * StreamHub J.A.R.V.I.S. - il connettore, in un file solo
 * ---------------------------------------------------------------------------
 * Il connettore Xtream Codes API in versione compatta: tutto il protocollo in
 * un file solo, senza dipendenze da installare e senza catalogo su disco.
 *
 * ---------------------------------------------------------------------------
 * COME SI USA (2 passi)
 * ---------------------------------------------------------------------------
 *
 *  1) Prepara la configurazione (una volta sola):
 *
 *         cp .env.example .env
 *
 *     e apri .env: metti XTREAM_USERNAME e XTREAM_PASSWORD. Sono esattamente
 *     le credenziali che poi digiti in IBO Player Pro. Tutto il resto
 *     (PORT, SERVER_URL, ...) ha valori di default sensati.
 *
 *  2) Avvialo:
 *
 *         node simple/server.js
 *
 *     Poi in IBO Player Pro: Server = http://<tuo-ip>:8080,
 *     Username e Password = quelli che hai messo in .env.
 *
 * ---------------------------------------------------------------------------
 * CREDENZIALI
 * ---------------------------------------------------------------------------
 *
 *  Non sono mai nel sorgente: arrivano dal .env o dalle variabili
 *  d'ambiente XTREAM_USERNAME / XTREAM_PASSWORD. Senza credenziali
 *  configurate il server NON parte (meglio un errore chiaro che una porta
 *  aperta con password vuota).
 *
 * ---------------------------------------------------------------------------
 * MODALITA' DI ESECUZIONE (rilevate automaticamente)
 * ---------------------------------------------------------------------------
 *
 *  1. NODE PURO      -> il caso normale: nessuna dipendenza, solo il modulo
 *     `http` di Node. `node simple/server.js` e basta.
 *
 *  2. EXPRESS        -> se imposti USE_EXPRESS=1 e `express` e' installato.
 *
 *  3. ENDPOINT HTTP  -> dentro un notebook che espone un endpoint
 *     (`exports.endpoint`), per chi vuole un URL HTTPS senza gestire
 *     un server.
 *
 *  4. BROWSER        -> nessun `require` disponibile (editor statico lato
 *     browser): simula le risposte e le stampa in console, cosi' da vedere
 *     subito i JSON che la TV ricevera'.
 */

/* ============================ 1. CONFIGURAZIONE ============================ */

/**
 * Carica `.env` dentro process.env (solo in Node).
 * - Node >= 20.12: usa process.loadEnvFile()
 * - altrimenti: parser minimale inline
 * Le variabili gia' presenti nell'ambiente hanno la precedenza.
 */
function loadDotEnv() {
  if (typeof process === 'undefined' || !process.env) return;
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile();
      return;
    } catch (e) {
      /* nessun .env: si prosegue con le variabili d'ambiente */
    }
  }
  try {
    var fs = require('fs');
    var path = require('path');
    var file = path.join(process.cwd(), '.env');
    if (!fs.existsSync(file)) return;
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line || line.charAt(0) === '#') return;
      var eq = line.indexOf('=');
      if (eq === -1) return;
      var key = line.slice(0, eq).trim();
      var value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (process.env[key] === undefined) process.env[key] = value;
    });
  } catch (e) {
    /* fs non disponibile (browser): si prosegue */
  }
}

loadDotEnv();

// Siamo in Node (e non in un browser)?
var IS_NODE =
  typeof process !== 'undefined' && !!process.env && typeof require === 'function';

var ENV = (typeof process !== 'undefined' && process.env) || {};

var CONFIG = {
  // ---------------------------------------------------------------------
  // CREDENZIALI
  //
  // Non stanno nel sorgente: arrivano dal file .env (o dalle variabili
  // d'ambiente XTREAM_USERNAME / XTREAM_PASSWORD).
  //
  //   cp .env.example .env
  //
  // e poi riempi XTREAM_USERNAME e XTREAM_PASSWORD. Sono esattamente le
  // credenziali che digiti in IBO Player Pro.
  // ---------------------------------------------------------------------
  username: ENV.XTREAM_USERNAME || '',
  password: ENV.XTREAM_PASSWORD || '',

  // Credenziali di DEMO: usate solo nella modalita' browser (editor statico),
  // dove non esiste un ambiente da cui leggere il .env.
  demoUsername: 'demo',
  demoPassword: 'demo',

  // Messaggio di benvenuto: appare nei dettagli utente del player.
  message: ENV.APP_MESSAGE || 'J.A.R.V.I.S. online - StreamHub',

  // Icona personalizzata (stemma originale, SVG inline: nessuna dipendenza).
  // Sostituiscila con un URL assoluto se preferisci (es. la tua locandina).
  logo:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiI+CiAgPGRlZnM+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9ImNvcmUiIGN4PSI1MCUiIGN5PSI1MCUiIHI9IjUwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNmZmY2ZDgiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIzNSUiIHN0b3AtY29sb3I9IiNmMGI0MjkiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjOGE1YTEwIi8+CiAgICA8L3JhZGlhbEdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50IGlkPSJoYWxvIiBjeD0iNTAlIiBjeT0iNDIlIiByPSI1NSUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMmEwYjBmIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzBhMDQwNSIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ29sZCIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZkOTc5Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2M5OGExYiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiBmaWxsPSJ1cmwoI2hhbG8pIi8+CgogIDwhLS0gYWxvbmUgZXN0ZXJubyAtLT4KICA8Y2lyY2xlIGN4PSIyNTYiIGN5PSIxOTYiIHI9IjE2OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBiNDI5IiBzdHJva2Utb3BhY2l0eT0iMC4xNiIgc3Ryb2tlLXdpZHRoPSIxMCIvPgoKICA8IS0tIHJhZ2dpIGVzdGVybmkgLS0+CiAgPGcgc3Ryb2tlPSJ1cmwoI2dvbGQpIiBzdHJva2Utd2lkdGg9IjkiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLW9wYWNpdHk9IjAuODUiPgogICAgPGxpbmUgeDE9IjI1NiIgeTE9IjI4IiAgeDI9IjI1NiIgeTI9IjYyIi8+CiAgICA8bGluZSB4MT0iMjU2IiB5MT0iMzMwIiB4Mj0iMjU2IiB5Mj0iMzY0Ii8+CiAgICA8bGluZSB4MT0iODgiICB5MT0iMTk2IiB4Mj0iMTIyIiB5Mj0iMTk2Ii8+CiAgICA8bGluZSB4MT0iMzkwIiB5MT0iMTk2IiB4Mj0iNDI0IiB5Mj0iMTk2Ii8+CiAgICA8bGluZSB4MT0iMTM3IiB5MT0iNzciICB4Mj0iMTYxIiB5Mj0iMTAxIi8+CiAgICA8bGluZSB4MT0iMzUxIiB5MT0iMjkxIiB4Mj0iMzc1IiB5Mj0iMzE1Ii8+CiAgICA8bGluZSB4MT0iMzc1IiB5MT0iNzciICB4Mj0iMzUxIiB5Mj0iMTAxIi8+CiAgICA8bGluZSB4MT0iMTYxIiB5MT0iMjkxIiB4Mj0iMTM3IiB5Mj0iMzE1Ii8+CiAgICA8bGluZSB4MT0iMTkyIiB5MT0iNDMiICB4Mj0iMjA2IiB5Mj0iNzQiLz4KICAgIDxsaW5lIHgxPSIzMjAiIHkxPSI0MyIgIHgyPSIzMDYiIHkyPSI3NCIvPgogICAgPGxpbmUgeDE9IjE5MiIgeTE9IjM0OSIgeDI9IjIwNiIgeTI9IjMxOCIvPgogICAgPGxpbmUgeDE9IjMyMCIgeTE9IjM0OSIgeDI9IjMwNiIgeTI9IjMxOCIvPgogICAgPGxpbmUgeDE9IjQzIiAgeTE9IjI2MCIgeDI9Ijc0IiAgeTI9IjI0NiIvPgogICAgPGxpbmUgeDE9IjQ2OSIgeTE9IjI2MCIgeDI9IjQzOCIgeTI9IjI0NiIvPgogICAgPGxpbmUgeDE9IjQzIiAgeTE9IjEzMiIgeDI9Ijc0IiAgeTI9IjE0NiIvPgogICAgPGxpbmUgeDE9IjQ2OSIgeTE9IjEzMiIgeDI9IjQzOCIgeTI9IjE0NiIvPgogIDwvZz4KCiAgPCEtLSBhbmVsbG8gZXN0ZXJubyAtLT4KICA8Y2lyY2xlIGN4PSIyNTYiIGN5PSIxOTYiIHI9IjE0OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ1cmwoI2dvbGQpIiBzdHJva2Utd2lkdGg9IjEzIi8+CiAgPCEtLSBhbmVsbG8gaW50ZXJubyAtLT4KICA8Y2lyY2xlIGN4PSIyNTYiIGN5PSIxOTYiIHI9IjEwNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYzk4YTFiIiBzdHJva2Utd2lkdGg9IjciIHN0cm9rZS1vcGFjaXR5PSIwLjkiLz4KICA8IS0tIGFuZWxsbyBwdW50ZWdnaWF0byBpbnRlcm5vIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjE5NiIgcj0iNzYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2YwYjQyOSIgc3Ryb2tlLXdpZHRoPSI0IgogICAgICAgICAgc3Ryb2tlLWRhc2hhcnJheT0iNSAxMyIgc3Ryb2tlLW9wYWNpdHk9IjAuNzUiLz4KCiAgPCEtLSByYWdnaSBkZWwgbnVjbGVvIC0tPgogIDxnIHN0cm9rZT0iI2YwYjQyOSIgc3Ryb2tlLXdpZHRoPSI2IiBzdHJva2Utb3BhY2l0eT0iMC41NSI+CiAgICA8bGluZSB4MT0iMjU2IiB5MT0iMTQwIiB4Mj0iMjU2IiB5Mj0iMTEyIi8+CiAgICA8bGluZSB4MT0iMjU2IiB5MT0iMjUyIiB4Mj0iMjU2IiB5Mj0iMjgwIi8+CiAgICA8bGluZSB4MT0iMjAwIiB5MT0iMTk2IiB4Mj0iMTcyIiB5Mj0iMTk2Ii8+CiAgICA8bGluZSB4MT0iMzEyIiB5MT0iMTk2IiB4Mj0iMzQwIiB5Mj0iMTk2Ii8+CiAgICA8bGluZSB4MT0iMjE3IiB5MT0iMTU3IiB4Mj0iMTk4IiB5Mj0iMTM4Ii8+CiAgICA8bGluZSB4MT0iMjk1IiB5MT0iMjM1IiB4Mj0iMzE0IiB5Mj0iMjU0Ii8+CiAgICA8bGluZSB4MT0iMjk1IiB5MT0iMTU3IiB4Mj0iMzE0IiB5Mj0iMTM4Ii8+CiAgICA8bGluZSB4MT0iMjE3IiB5MT0iMjM1IiB4Mj0iMTk4IiB5Mj0iMjU0Ii8+CiAgPC9nPgoKICA8IS0tIG51Y2xlbyAtLT4KICA8Y2lyY2xlIGN4PSIyNTYiIGN5PSIxOTYiIHI9IjUyIiBmaWxsPSJ1cmwoI2NvcmUpIi8+CiAgPGNpcmNsZSBjeD0iMjU2IiBjeT0iMTk2IiByPSI1MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmMGMyIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1vcGFjaXR5PSIwLjgiLz4KICA8Y2lyY2xlIGN4PSIyNTYiIGN5PSIxOTYiIHI9IjI2IiBmaWxsPSIjZmZmYmU4IiBmaWxsLW9wYWNpdHk9IjAuOTIiLz4KCiAgPCEtLSBsZXR0ZXJpbmcgLS0+CiAgPHRleHQgeD0iMjU2IiB5PSI0MDQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJIZWx2ZXRpY2EgTmV1ZSwgSGVsdmV0aWNhLCBBcmlhbCwgc2Fucy1zZXJpZiIKICAgICAgICBmb250LXNpemU9IjUyIiBmb250LXdlaWdodD0iYm9sZCIgbGV0dGVyLXNwYWNpbmc9IjEwIiBmaWxsPSJ1cmwoI2dvbGQpIj5KLkEuUi5WLkkuUy48L3RleHQ+CiAgPHRleHQgeD0iMjU2IiB5PSI0NDQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJIZWx2ZXRpY2EgTmV1ZSwgSGVsdmV0aWNhLCBBcmlhbCwgc2Fucy1zZXJpZiIKICAgICAgICBmb250LXNpemU9IjE5IiBsZXR0ZXItc3BhY2luZz0iNiIgZmlsbD0iI2M5YTNhMyI+U1RSRUFNSFVCPC90ZXh0Pgo8L3N2Zz4K',

  // Flussi di test: clip corte (33s e 52s, pochi MB) con AUDIO (h264 + aac),
  // cosi' il test sulla TV e' istantaneo e si sente anche il suono.
  // Per video piu' lunghi, o per i tuoi file, cambia questi URL.
  //   -> alternative piu' lunghi, se vuoi:
  //      https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4
  //      https://archive.org/download/Sintel/sintel-2048-stereo.mp4
  //      https://archive.org/download/ElephantsDream/ed_hd.mp4
  streams: {
    bunny: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    sintel: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    tears: 'https://media.w3.org/2010/05/video/movie_300.mp4',
  },

  // Prefisso con cui il client contatta il gateway dei flussi.
  // Viene calcolato dalle credenziali: non va scritto a mano.
  streamPath: '',

};

// L'SVG del logo, estratto dal data URI: cosi' lo possiamo servire
// come URL vero (/logo.svg) invece di inlinearlo in ogni risposta.
// I client si aspettano un https://, non un data:image/svg+xml.
var LOGO_SVG = '';
try {
  var m = String(CONFIG.logo).match(/^data:image\/svg\+xml;base64,(.*)$/);
  if (m) LOGO_SVG = Buffer.from(m[1], 'base64').toString('utf8');
} catch (e) {
  LOGO_SVG = '';
}

/** URL assoluto di una risorsa del server. */
function absUrl(value, base) {
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || value.indexOf('data:') === 0) return value;
  return base + (value.charAt(0) === '/' ? value : '/' + value);
}

// CONFIG.streamPath dipende dalle credenziali: lo calcoliamo qui'.
CONFIG.streamPath = CONFIG.username + '/' + CONFIG.password;

// Senza credenziali configurate il server non parte: meglio fallire subito
// che esporre una porta aperta con password vuota. Nel browser, dove non
// esiste un .env, si usa la coppia di demo.
var HAS_CREDENTIALS = !!(CONFIG.username && CONFIG.password);
if (!HAS_CREDENTIALS && !IS_NODE) {
  CONFIG.username = CONFIG.demoUsername;
  CONFIG.password = CONFIG.demoPassword;
  CONFIG.streamPath = CONFIG.username + '/' + CONFIG.password;
}

/* ============================ 2. CATALOGO ============================ */

var CATALOG = {
  vodCategories: [
    { category_id: '1', category_name: 'J.A.R.V.I.S. · Video Locali (Test)', parent_id: 0 },
    { category_id: '2', category_name: 'J.A.R.V.I.S. · Film TMDb (Test)', parent_id: 0 },
  ],
  vodStreams: [
    {
      stream_id: 1101,
      name: 'Video Personale di Test 01',
      category_id: '1',
      container_extension: 'mp4',
      icon: '/logo.svg',
      source: CONFIG.streams.bunny,
      info: {
        tmdb_id: '',
        plot: 'Video personale di prova. Sostituisci questo flusso con un file .mp4 tuo.',
        cast: 'StreamHub J.A.R.V.I.S.',
        director: 'Henry (test)',
        genre: 'Test, Locale',
        releaseDate: '2026-11-14',
        rating: '0',
        runtime: '20',
      },
    },
    {
      stream_id: 1001,
      name: 'Iron Man (2008) · SCHEDA TEST',
      category_id: '2',
      container_extension: 'mp4',
      icon: 'https://image.tmdb.org/t/p/w500/xWXuFC4FY0inQ1QsnDrE7fGwFEd.jpg',
      source: CONFIG.streams.sintel,
      info: {
        tmdb_id: '1726',
        plot:
          "Scheda dimostrativa: il titolo e la locandina arrivano da TMDb, il flusso video e' un video di test.",
        cast: 'Robert Downey Jr., Gwyneth Paltrow, Jeff Bridges',
        director: 'Jon Favreau',
        genre: 'Azione, Avventura, Sci-Fi',
        releaseDate: '2008-05-02',
        rating: '7.9',
        runtime: '126',
      },
    },
  ],
  seriesCategories: [
    { category_id: '10', category_name: 'J.A.R.V.I.S. · Serie TMDb (Test)', parent_id: 0 },
  ],
  series: [
    {
      series_id: 2001,
      name: 'Iron Man: Armored Adventures',
      title: 'Iron Man: Armored Adventures',
      year: 2009,
      category_id: '10',
      cover: 'https://image.tmdb.org/t/p/w500/kIJGgBwh37V2nfgnJFaN7zDIjdv.jpg',
      plot: 'Scheda dimostrativa ricavata da TMDb, con episodi che puntano a flussi di prova.',
      cast: 'Voce cast di esempio',
      director: 'Regia di esempio',
      genre: 'Animazione, Azione, Sci-Fi',
      releaseDate: '2009-04-24',
      rating: '8.1',
      rating_5based: 4.1,
      episode_run_time: '24',
      seasons: [
        {
          season_number: 1,
          name: 'Stagione 1 · Test',
          air_date: '2009-04-24',
          episodes: [
            { id: 200101, episode_num: 1, title: 'Episodio di Test 1', source: CONFIG.streams.bunny, plot: 'Primo episodio di prova.' },
            { id: 200102, episode_num: 2, title: 'Episodio di Test 2', source: CONFIG.streams.sintel, plot: 'Secondo episodio di prova.' },
          ],
        },
      ],
    },
  ],
  liveCategories: [{ category_id: '20', category_name: 'J.A.R.V.I.S. · Live Test', parent_id: 0 }],
  liveStreams: [
    {
      stream_id: 3001,
      name: 'J.A.R.V.I.S. Live Test',
      category_id: '20',
      icon: '/logo.svg',
      epg_channel_id: 'jarvis.live.test',
      source: CONFIG.streams.tears,
    },
  ],
};

/* ============================ 3. MOTORE XTREAM ============================ */

/**
 * Indirizzo pubblico del server.
 *
 * Se e' impostato (variabile SERVER_URL) ha la precedenza su tutto: e' lui
 * l'indirizzo che il server annuncia al player in server_info e nelle URL dei
 * flussi. Serve a tenerlo stabile anche se il player si collega in un modo
 * diverso (rete locale, proxy, dominio pubblico).
 *
 * Se vuoto, l'indirizzo viene dedotto dall'host con cui il client chiama:
 * comodo in locale, basta non toccare nulla.
 */
var SERVER_URL = ENV.SERVER_URL ? String(ENV.SERVER_URL).replace(/\/+$/, '') : '';

function baseUrlFrom(req) {
  if (SERVER_URL) return SERVER_URL;
  var host = (req && req.headers && req.headers.host) || 'localhost:8080';
  // Il protocollo segue come ci siamo connessi: dietro un proxy che
  // termina il TLS arriva X-Forwarded-Proto, altrimenti questo server
  // parla HTTP in chiaro.
  var proto =
    (req && req.headers && req.headers['x-forwarded-proto']) ||
    (req && req.socket && req.socket.encrypted ? 'https' : 'http');
  return proto + '://' + host;
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function userInfo(base) {
  return {
    username: CONFIG.username,
    password: CONFIG.password,
    message: CONFIG.message,
    auth: 1,
    status: 'Active',
    exp_date: String(now() + 60 * 60 * 24 * 365 * 3),
    is_trial: '0',
    active_cons: '1',
    created_at: String(now()),
    max_connections: '5',
    // I formati che questo server sa consegnare. Devono includere anche
    // quelli del VOD (i nostri file sono .mp4): alcuni client, se non
    // trovano il formato del contenuto in questa lista, scartano il
    // catalogo VOD e mostrano la sezione vuota.
    allowed_output_formats: ['ts', 'm3u8', 'mp4', 'mkv'],
    logo: LOGO_SVG ? absUrl('/logo.svg', base) : CONFIG.logo,
  };
}

function serverInfo(base) {
  var url = 'localhost';
  var port = '8080';
  try {
    var parsed = new URL(base);
    url = parsed.hostname;
    port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  } catch (e) {}
  return {
    url: url,
    port: port,
    https_port: '443',
    server_protocol: base.indexOf('https://') === 0 ? 'https' : 'http',
    rtmp_port: '1935',
    timezone: 'Europe/Rome',
    timestamp_now: now(),
    time_now: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
}

function isAuthed(params) {
  var u = String(params.username || '').trim().toLowerCase();
  var p = String(params.password || '');
  return !!u && !!p && u === CONFIG.username.toLowerCase() && p === CONFIG.password;
}

function unauthorized() {
  return {
    user_info: { username: '', password: '', message: 'Credenziali non valide', auth: 0, status: 'Disabled' },
  };
}

/** URL del flusso costruito dal client a partire da stream_id + estensione. */
function streamUrl(base, streamId, ext) {
  return base + '/' + CONFIG.streamPath + '/' + streamId + '.' + (ext || 'mp4');
}

/**
 * Costruisce il payload Xtream per una data action.
 * E' la funzione che il client chiama, in un colpo solo.
 */
function buildPayload(action, params, base) {
  if (!isAuthed(params)) return { status: 401, body: unauthorized() };

  switch (action) {
    case '':
    case 'get_account_info':
      return {
        status: 200,
        body: {
          user_info: userInfo(base),
          server_info: serverInfo(base),
          logo: CONFIG.logo,
          app_name: 'StreamHub J.A.R.V.I.S.',
        },
      };

    case 'get_vod_categories':
      return { status: 200, body: CATALOG.vodCategories };

    case 'get_vod_streams':
      return {
        status: 200,
        body: CATALOG.vodStreams.map(function (s) {
          return {
            num: Number(s.stream_id),
            name: s.name,
            stream_type: 'movie',
            stream_id: Number(s.stream_id),
            stream_icon: absUrl(s.icon || '', base),
            epg_channel_id: null,
            added: String(now()),
            category_id: String(s.category_id),
            container_extension: s.container_extension || 'mp4',
            custom_sid: '',
            tv_archive: 0,
            direct_source: s.source || streamUrl(base, s.stream_id, s.container_extension),
            tv_archive_duration: 0,
          };
        }),
      };

    case 'get_vod_info': {
      var vod = CATALOG.vodStreams.filter(function (s) {
        return String(s.stream_id) === String(params.vod_id);
      })[0];
      if (!vod) return { status: 200, body: {} };
      var info = vod.info || {};
      return {
        status: 200,
        body: {
          info: {
            tmdb_id: info.tmdb_id || '',
            name: vod.name,
            cover: vod.icon || '',
            plot: info.plot || '',
            cast: info.cast || '',
            director: info.director || '',
            genre: info.genre || '',
            releaseDate: info.releaseDate || '',
            rating: info.rating || '',
            rating_5based: info.rating_5based || '',
            runtime: info.runtime || '',
            duration_secs: 0,
          },
          movie_data: {
            stream_id: Number(vod.stream_id),
            name: vod.name,
            added: String(now()),
            category_id: String(vod.category_id),
            container_extension: vod.container_extension || 'mp4',
            custom_sid: '',
            direct_source: vod.source || streamUrl(base, vod.stream_id, vod.container_extension),
          },
        },
      };
    }

    case 'get_series_categories':
      return { status: 200, body: CATALOG.seriesCategories };

    case 'get_series':
      return {
        status: 200,
        body: CATALOG.series.map(function (s, index) {
          return {
            num: index + 1,
            id: Number(s.series_id),
            // series_id e' OBBLIGATORIO: senza il player non sa quale id
            // usare per get_series_info e la griglia serie resta vuota.
            series_id: Number(s.series_id),
            name: s.name,
            title: s.title || s.name,
            year: Number(s.year) || 0,
            stream_type: 'series',
            cover: s.cover || '',
            plot: s.plot || '',
            cast: s.cast || '',
            director: s.director || '',
            genre: s.genre || '',
            releaseDate: s.releaseDate || '',
            release_date: s.releaseDate || '',
            last_modified: new Date().toISOString().replace('T', ' ').slice(0, 19),
            rating: s.rating || '',
            rating_5based: s.rating_5based || '',
            backdrop_path: [],
            youtube_trailer: '',
            episode_run_time: s.episode_run_time || '',
            category_id: String(s.category_id),
            category_ids: [String(s.category_id)],
          };
        }),
      };

    case 'get_series_info': {
      var serie = CATALOG.series.filter(function (s) {
        return String(s.series_id) === String(params.series_id);
      })[0];
      if (!serie) return { status: 200, body: { seasons: [], info: {}, episodes: {} } };
      var seasons = [];
      var episodes = {};
      // Blocco `info` della serie (usato dal player per la scheda).
      var seriesMeta = {
        num: 1,
        id: Number(serie.series_id),
        series_id: Number(serie.series_id),
        name: serie.name,
        title: serie.title || serie.name,
        year: Number(serie.year) || 0,
        stream_type: 'series',
        cover: serie.cover || '',
        plot: serie.plot || '',
        cast: serie.cast || '',
        director: serie.director || '',
        genre: serie.genre || '',
        releaseDate: serie.releaseDate || '',
        release_date: serie.releaseDate || '',
        last_modified: new Date().toISOString().replace('T', ' ').slice(0, 19),
        rating: serie.rating || '',
        rating_5based: serie.rating_5based || '',
        backdrop_path: [],
        youtube_trailer: '',
        episode_run_time: serie.episode_run_time || '',
        category_id: String(serie.category_id),
        category_ids: [String(serie.category_id)],
      };
      (serie.seasons || []).forEach(function (season) {
        seasons.push({
          season_number: Number(season.season_number),
          name: season.name || 'Stagione ' + season.season_number,
          episode_count: (season.episodes || []).length,
          id: Number(serie.series_id),
          air_date: season.air_date || '',
          cover: season.cover || serie.cover || '',
        });
        episodes[String(season.season_number)] = (season.episodes || []).map(function (ep) {
          return {
            id: Number(ep.id),
            episode_num: Number(ep.episode_num),
            title: ep.title || 'Episodio ' + ep.episode_num,
            container_extension: ep.container_extension || 'mp4',
            info: {
              tmdb_id: serie.info_tmdb_id || '',
              release_date: season.air_date || '',
              plot: ep.plot || '',
              cover: serie.cover || '',
              duration_secs: 0,
              season_number: Number(season.season_number),
              episode_number: Number(ep.episode_num),
            },
            custom_sid: '',
            added: String(now()),
            season_number: Number(season.season_number),
            direct_source: ep.source || streamUrl(base, ep.id, 'mp4'),
          };
        });
      });
      return { status: 200, body: { seasons: seasons, info: seriesMeta, episodes: episodes } };
    }

    case 'get_live_categories':
      return { status: 200, body: CATALOG.liveCategories };

    case 'get_live_streams':
      // ARRAY NUDO, come nel pannello Xtream originale: le liste di
      // stream (vod, live) sono array, non oggetti avvolti. Alcuni client
      // rifiutano la forma {user_info, server_info, data} e rimangono in
      // loop di caricamento.
      return {
        status: 200,
        body: CATALOG.liveStreams.map(function (l) {
          return {
            num: Number(l.stream_id),
            name: l.name,
            stream_type: 'live',
            stream_id: Number(l.stream_id),
            stream_icon: absUrl(l.icon || '', base),
            epg_channel_id: l.epg_channel_id || '',
            added: String(now()),
            category_id: String(l.category_id),
            custom_sid: '',
            tv_archive: 0,
            direct_source: l.source || streamUrl(base, l.stream_id, 'ts'),
            tv_archive_duration: 0,
          };
        }),
      };

    case 'get_short_episodes':
    case 'get_blocked_ips':
      return { status: 200, body: [] };

    default:
      return { status: 200, body: {} };
  }
}

/* ============================ 4. ADATTATORE HTTP ============================ */

/** Parsing di query string e body (POST form-urlencoded). */
function parseParams(queryString, bodyText) {
  var params = {};
  function merge(text) {
    if (!text) return;
    var pairs = String(text).replace(/^\?/, '').split('&');
    for (var i = 0; i < pairs.length; i++) {
      if (!pairs[i]) continue;
      var idx = pairs[i].indexOf('=');
      var key = decodeURIComponent((idx === -1 ? pairs[i] : pairs[i].slice(0, idx)).replace(/\+/g, ' '));
      var value = idx === -1 ? '' : decodeURIComponent(pairs[i].slice(idx + 1).replace(/\+/g, ' '));
      params[key] = value;
    }
  }
  merge(queryString);
  merge(bodyText);
  return params;
}

/** Router: `/player_api.php`, `/get.php`, `/health`. */

/**
 * EPG in XMLTV: i client lo scaricano per i canali live.
 * Se questa richiesta fallisce, alcuni player (iOS) abortano il download
 * dell'intero catalogo e restano con le sezioni vuote.
 */
function buildEpg(base) {
  var channels = CATALOG.liveStreams || [];
  var lines = [];
  var now = Math.floor(Date.now() / 1000);

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<!DOCTYPE tv SYSTEM "xmltv.dtd">');
  lines.push('<tv generator-info-name="StreamHub J.A.R.V.I.S.">');

  for (var i = 0; i < channels.length; i++) {
    var c = channels[i];
    var id = c.epg_channel_id || String(c.stream_id);
    lines.push('  <channel id="' + id + '">');
    lines.push('    <display-name>' + (c.name || id) + '</display-name>');
    if (c.icon) lines.push('    <icon src="' + absUrl(c.icon, base) + '" />');
    lines.push('  </channel>');

    // Un blocco di programmi, cosi' l'EPG non e' vuoto.
    for (var p = 0; p < 4; p++) {
      var start = now + p * 3600;
      var stop = start + 3600;
      function fmt(ts) {
        var d = new Date(ts * 1000);
        return d.toISOString().replace('T', ' ').slice(0, 19) + ' +0000';
      }
      lines.push('  <programme start="' + fmt(start) + '" stop="' + fmt(stop) + '" channel="' + id + '">');
      lines.push('    <title>' + (c.name || 'Programma') + '</title>');
      lines.push('    <desc>Programma di test del connettore StreamHub J.A.R.V.I.S.</desc>');
      lines.push('  </programme>');
    }
  }

  lines.push('</tv>');
  return lines.join('\n');
}

function route(pathname, queryString, bodyText, req) {
  var base = baseUrlFrom(req);
  var params = parseParams(queryString, bodyText);

  if (pathname === '/xmltv.php') {
    return { status: 200, body: buildEpg(baseUrlFrom(req)), type: 'application/xml; charset=utf-8' };
  }

  if (pathname === '/logo.svg') {
    return { status: 200, body: LOGO_SVG, type: 'image/svg+xml' };
  }

  if (pathname === '/health') {
    return {
      status: 200,
      body: { status: 'ok', app: 'StreamHub J.A.R.V.I.S.', uptime_s: Math.floor(Date.now() / 1000) / 1000 },
    };
  }

  if (pathname === '/player_api.php') {
    return buildPayload(String(params.action || '').trim(), params, base);
  }

  // Gateway dei flussi: il client chiede lo stream, il server risponde 302.
  if (pathname === '/get.php') {
    if (!isAuthed(params)) return { status: 401, body: unauthorized() };
    var all = CATALOG.vodStreams.concat(
      CATALOG.liveStreams.map(function (l) {
        return { stream_id: l.stream_id, source: l.source };
      })
    );
    CATALOG.series.forEach(function (s) {
      (s.seasons || []).forEach(function (season) {
        (season.episodes || []).forEach(function (ep) {
          all.push({ stream_id: ep.id, source: ep.source });
        });
      });
    });
    var found = all.filter(function (s) {
      return String(s.stream_id) === String(params.stream);
    })[0];
    if (!found) return { status: 404, body: { error: 'stream_not_found' } };
    return { status: 302, location: found.source || streamUrl(base, params.stream, params.extension) };
  }

  // Path classico Xtream. I player reali usano il formato
  // /{tipo}/{username}/{password}/{stream_id}.{ext}
  // con tipo = movie | live | series | vod (il tipo e' facoltativo).
  var classic = pathname.match(
    /^\/(?:(?:movie|live|series|vod)\/)?([^\/]+)\/([^\/]+)\/(\d+)\.([a-z0-9]+)$/i
  );
  if (classic) {
    return route(
      '/get.php',
      'username=' + encodeURIComponent(classic[1]) +
        '&password=' + encodeURIComponent(classic[2]) +
        '&stream=' + classic[3] +
        '&extension=' + classic[4],
      '',
      req
    );
  }

  return { status: 404, body: { error: 'not_found' } };
}

/** Handler in stile node:http (usato dai server e dagli endpoint HTTP). */
/**
 * Access log: una riga per ogni richiesta.
 *
 * E' la finestra sul player: senza questo non si capisce cosa chiede
 * IBO Player e dove si ferma. La password viene mascherata (i player la
 * mandano in chiaro nella query string).
 *
 * Disattivabile con ACCESS_LOG=0.
 */
var ACCESS_LOG = (typeof process === 'undefined' || process.env.ACCESS_LOG !== '0');

// Dove finisce il log delle richieste su file. Lo stesso file e' letto da
// `npm run logs`, cosi' funziona sia che il server giri in primo piano
// (npm start) sia in background (npm run start:bg).
var LOG_FILE =
  (typeof process !== 'undefined' && process.env && process.env.LOG_FILE) ||
  '/tmp/jarvis.log';

/** Accoda una riga sul file di log (senza bloccare, se non si puo' scrivere). */
function appendLogFile(line) {
  try {
    if (typeof require !== 'function') return;
    var fs = require('fs');
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {
    /* filesystem non scrivibile: si continua con la console */
  }
}

function logRequest(req, res, startedAt) {
  if (!ACCESS_LOG || typeof console === 'undefined') return;
  var ms = Date.now() - startedAt;
  var ip =
    (req.headers && req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (req.socket && req.socket.remoteAddress) ||
    '-';
  var ua = (req.headers && req.headers['user-agent']) || '-';
  // Maschera la password: i player la mandano in chiaro, sia in query
  // string (/player_api.php?password=...) sia nel path classico
  // (/movie/{utente}/{password}/{id}.mp4).
  var url = String(req.url || '')
    .replace(/([?&]password=)[^&]*/gi, '$1***')
    .replace(/(\/[^/?]+\/)([^/?]+)(\/\d+\.)/g, '$1***$3');
  if (url.length > 160) url = url.slice(0, 157) + '...';
  var line =
    new Date().toISOString() + ' ' + res.statusCode + ' ' + req.method + ' ' + url +
    ' ip=' + ip + ' ' + ms + 'ms ua="' + String(ua).slice(0, 90) + '"';
  console.log(line);
  appendLogFile(line);
}

function handleRequest(req, res) {
  var startedAt = Date.now();
  var parts = String(req.url || '/').split('?');
  var pathname = parts[0];
  var queryString = parts[1] || '';
  var bodyText = '';

  res.on('finish', function () {
    logRequest(req, res, startedAt);
  });

  if (req.method === 'POST') {
    var chunks = [];
    req.on('data', function (c) {
      chunks.push(c);
    });
    req.on('end', function () {
      bodyText = Buffer.concat(chunks).toString('utf8');
      respond(pathname, queryString, bodyText, req, res);
    });
    req.on('error', function () {
      respond(pathname, queryString, '', req, res);
    });
    return;
  }

  respond(pathname, queryString, bodyText, req, res);
}

/**
 * Modalita' di consegna del flusso:
 *   'proxy'    -> il server scarica il file e lo passa al player (default).
 *                 Il player deve raggiungere SOLO noi: robusto e, soprattutto,
 *                 si vede nel log cosa chiede il player (Range, byte, ...).
 *   'redirect' -> il server risponde 302 e il player va a prendere il file
 *                 direttamente dalla sorgente.
 *
 * Si sceglie con la variabile d'ambiente PROXY_STREAMS (1 = proxy, 0 = redirect).
 */
var PROXY_STREAMS =
  (typeof process === 'undefined' || process.env.PROXY_STREAMS !== '0');

// Quanto tempo aspettiamo l'origine prima di riprovare (e poi redirigere).
var PROXY_TIMEOUT = Number(
  (typeof process !== 'undefined' && process.env && process.env.PROXY_TIMEOUT) || 20000
);

/**
 * Passa il flusso attraverso il server, inoltrando la richiesta Range.
 * @param {object} req  richiesta del player
 * @param {object} res  risposta
 * @param {string} sourceUrl  file di origine
 * @param {number} depth  protezione dai redirect infiniti
 * @param {number} attempt  tentativi di connessione all'origine
 */
function proxyStream(req, res, sourceUrl, depth, attempt) {
  depth = depth || 0;
  attempt = attempt || 0;

  // Se la risposta e' gia' partita non si tocca piu': altrimenti si scrive
  // due volte la stessa intestazione e il processo muore.
  if (res.headersSent) {
    try { res.end(); } catch (e) { /* gia' chiusa */ }
    return;
  }

  if (depth > 4) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'too_many_redirects' }));
    return;
  }

  // Piano B: se l'origine non si raggiunge, si risponde con la redirect.
  // Il player va cosi' a prendere il file direttamente dalla sorgente,
  // invece di ricevere un 502 e restare con la schermata nera.
  if (attempt >= 2) {
    res.writeHead(302, {
      Location: sourceUrl,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end();
    return;
  }

  var client = sourceUrl.indexOf('https://') === 0 ? require('https') : require('http');
  var headers = {};
  // Il player usa Range per lo seeking: va inoltrato.
  if (req.headers && req.headers.range) headers.Range = req.headers.range;

  var upReq = client.get(sourceUrl, { headers: headers }, function (up) {
    // Nel frattempo la risposta potrebbe essere gia' iniziata.
    if (res.headersSent) { up.resume(); return; }

    if (up.statusCode >= 300 && up.statusCode < 400 && up.headers.location) {
      up.resume();
      proxyStream(req, res, up.headers.location, depth + 1, attempt);
      return;
    }
    // Errore lato dell'origine (5xx): vale la pena riprovare.
    if (up.statusCode >= 500) {
      up.resume();
      proxyStream(req, res, sourceUrl, depth, attempt + 1);
      return;
    }
    var out = {
      'Content-Type': up.headers['content-type'] || 'video/mp4',
      'Accept-Ranges': up.headers['accept-ranges'] || 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    };
    if (up.headers['content-length']) out['Content-Length'] = up.headers['content-length'];
    if (up.headers['content-range']) out['Content-Range'] = up.headers['content-range'];
    res.writeHead(up.statusCode, out);
    up.pipe(res);
  });

  // Non aspettare all'infinito: l'origine puo' bloccarsi.
  upReq.setTimeout(PROXY_TIMEOUT, function () {
    upReq.destroy(new Error('timeout'));
  });

  // Errore a meta' streaming: la risposta e' gia' iniziata, si chiude e basta.
  upReq.on('error', function (err) {
    if (res.headersSent) {
      try { res.end(); } catch (e) { /* gia' chiusa */ }
      return;
    }
    // Un tentativo di riprovare, poi la redirect.
    proxyStream(req, res, sourceUrl, depth, attempt + 1);
  });

  // Errore dello stream a valle (dopo le intestazioni).
  upReq.on('response', function (up) {
    up.on('error', function () {
      try { res.end(); } catch (e) { /* gia' chiusa */ }
    });
  });
}

function respond(pathname, queryString, bodyText, req, res) {
  var result = route(pathname, queryString, bodyText, req);

  // Risorse statiche servite cosi' (es. il logo).
  if (result.type) {
    res.writeHead(result.status, {
      'Content-Type': result.type,
      'Content-Length': Buffer.byteLength(result.body || ''),
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(result.body || '');
    return;
  }

  if (result.status === 302 && result.location) {
    // In modalita' proxy il file viene passato attraverso il server;
    // altrimenti si risponde con la redirect verso la sorgente.
    if (PROXY_STREAMS && /^https?:\/\//i.test(result.location)) {
      proxyStream(req, res, result.location, 0);
      return;
    }
    res.writeHead(302, { Location: result.location, 'Access-Control-Allow-Origin': '*' });
    res.end();
    return;
  }

  var body = JSON.stringify(result.body);
  res.writeHead(result.status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/* ============================ 5. AVVIO ============================ */

function start() {
  var port = (typeof process !== 'undefined' && process.env && process.env.PORT) || 8080;

  // Senza credenziali non si avvia nessun server: si preferisce un errore
  // chiaro a una porta aperta con password vuota.
  if (IS_NODE && !HAS_CREDENTIALS) {
    console.error('');
    console.error('  XTREAM_USERNAME / XTREAM_PASSWORD mancanti.');
    console.error('  Copia il template e riempi le credenziali:');
    console.error('    cp .env.example .env');
    console.error('');
    if (typeof process !== 'undefined' && process.exit) process.exit(1);
    return 'missing-credentials';
  }

  /* --- 0) Notebook che espone un endpoint HTTP ------------------------
   * Solo se l'ambiente lo segnala: li' il codice NON deve stare in ascolto
   * su una porta, l'harness chiama exports.endpoint.
   * Su qualsiasi altro host questo ramo non parte e si va avanti. */
  if (IS_NODE && process.env.RUNKIT_ENDPOINT_URL) {
    try {
      var endpointExpress = require('@runkit/runkit/express-endpoint/1.0.0');
      var epApp = endpointExpress(exports);
      epApp.get('/player_api.php', function (req, res) {
        handleRequest({ method: 'GET', url: req.originalUrl || req.url, headers: req.headers }, res);
      });
      epApp.get('/get.php', function (req, res) {
        handleRequest({ method: 'GET', url: req.originalUrl || req.url, headers: req.headers }, res);
      });
      epApp.get('/health', function (req, res) {
        res.json({ status: 'ok', app: 'StreamHub J.A.R.V.I.S.' });
      });
      return 'endpoint';
    } catch (e) {
      /* l'ambiente non espone l'endpoint: si prosegue con i metodi normali */
    }
  }

  /* --- 1) Node puro: il caso normale, zero dipendenze ----------------
   * `node simple/server.js` e' tutto quello che serve: nessuna
   * dipendenza da installare. */
  try {
    var http = require('http');
    http.createServer(handleRequest).listen(port, function () {
      console.log('StreamHub J.A.R.V.I.S. (node:http) su http://0.0.0.0:' + port);
    });
    return 'node-http';
  } catch (e) {
    /* impossibile: si prosegue con gli altri metodi */
  }

/* --- 2) Express, se lo chiedi esplicitamente (USE_EXPRESS=1) -------- */
  if (IS_NODE && process.env.USE_EXPRESS === '1') {
    try {
      var express = require('express');
      var app = express();
      app.all('/player_api.php', function (req, res) {
        handleRequest(
          {
            method: req.method,
            url: req.originalUrl || req.url,
            headers: req.headers,
            on: function () {},
          },
          res
        );
      });
      app.all('/get.php', function (req, res) {
        handleRequest(
          {
            method: req.method,
            url: req.originalUrl || req.url,
            headers: req.headers,
            on: function () {},
          },
          res
        );
      });
      app.get('/health', function (req, res) {
        res.json({ status: 'ok', app: 'StreamHub J.A.R.V.I.S.' });
      });
      app.listen(port, function () {
        console.log('StreamHub J.A.R.V.I.S. (Express) su http://0.0.0.0:' + port);
      });
      return 'express';
    } catch (e) {
      console.error('  USE_EXPRESS=1 ma express non e installato: continuo con node:http.');
    }
  }

/* --- 4) Browser: nessun require -> dimostrazione in console --- */
  return 'browser';
}

var MODE = start();

/**
 * Rete di sicurezza: un errore non previsto non deve portare giù il
 * servizio. Il servizio si ferma solo quando lo fermi tu (Ctrl+C).
 * L'errore resta ben visibile nel log.
 */
process.on('uncaughtException', function (err) {
  console.error('');
  console.error('  [errore non gestito] ' + (err && err.stack ? err.stack : err));
  console.error('  Il servizio resta attivo.');
  console.error('');
});
process.on('unhandledRejection', function (reason) {
  console.error('  [promise rifiutata] ' + reason);
});

if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
  // Per gli ambienti che espongono un endpoint HTTP: la funzione che
  // gestisce request/response.
  exports.endpoint = handleRequest;
  exports.handler = handleRequest;
}

/* ============================ 6. MODALITA' BROWSER ============================ */

if (MODE === 'browser') {
  // Nel playground statico non esiste un server: simulo le risposte del
  // backend e le mostro in console, cosi' da vedere i JSON che la TV
  // ricevera' prima di configurare IBO Player.
  var DEMO_ACTIONS = [
    ['AUTENTICAZIONE (prima richiesta del player)', ''],
    ['CATEGORIE VOD', '&action=get_vod_categories'],
    ['FILM (VOD)', '&action=get_vod_streams'],
    ['DETTAGLIO FILM', '&action=get_vod_info&vod_id=1001'],
    ['CATEGORIE SERIE', '&action=get_series_categories'],
    ['SERIE', '&action=get_series'],
    ['STAGIONI + EPISODI', '&action=get_series_info&series_id=2001'],
    ['CATEGORIE LIVE', '&action=get_live_categories'],
    ['LIVE', '&action=get_live_streams'],
  ];

  var base = 'https://tuo-server.esempio.com';
  var auth = 'username=' + encodeURIComponent(CONFIG.username) + '&password=' + encodeURIComponent(CONFIG.password);

  console.log('%cJ.A.R.V.I.S. - StreamHub J.A.R.V.I.S.', 'color:#F0B429;font-size:16px;font-weight:bold');
  console.log('Messaggio: ' + CONFIG.message);
  console.log('Icona: ' + CONFIG.logo.slice(0, 48) + '...');
  console.log(
    'Credenziali: ' + CONFIG.username + ' / ' + CONFIG.password +
      (HAS_CREDENTIALS ? '' : '  (DEMO: nel browser non si puo\' leggere il .env)')
  );
  console.log('--------------------------------------------------');

  var summary = [];

  for (var i = 0; i < DEMO_ACTIONS.length; i++) {
    var label = DEMO_ACTIONS[i][0];
    var query = DEMO_ACTIONS[i][1];
    // Stessa logica del server: l'action arriva dai parametri, insieme
    // agli eventuali parametri extra (vod_id, series_id, ...).
    var params = parseParams(auth + query);
    var action = params.action || '';
    var result = buildPayload(action, params, base);
    var body = result.body;
    var size = Array.isArray(body) ? body.length + ' elementi' : Object.keys(body).length + ' chiavi';
    summary.push({ azione: action || '(autenticazione)', esito: result.status, contenuto: size });
    console.log('%c' + label, 'color:#6EE7A8;font-weight:bold');
    console.log(JSON.stringify(body, null, 2));
    console.log('--------------------------------------------------');
  }

  console.log('%cRIEPILOGO', 'color:#F0B429;font-weight:bold');
  if (typeof console.table === 'function') console.table(summary);
  else console.log(JSON.stringify(summary, null, 2));
  console.log(
    '%cProssimo passo: avvia il file con node (o su un host qualsiasi), ' +
      'poi inserisci URL + credenziali in IBO Player Pro.',
    'color:#F0B429'
  );
}

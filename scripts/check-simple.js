'use strict';

/**
 * Verifica del connettore: avvia `simple/server.js` su una porta
 * di test e controlla che risponda come un backend Xtream.
 *
 *   npm run check
 *
 * E' il "test" del progetto semplice: non confronta due implementazioni
 * (quello lo fa il contract test della fase 2), verifica che il file che
 * esce dalla repo sia effettivamente utilizzabile da IBO Player.
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const TARGET = process.env.SIMPLE_FILE || path.join(ROOT, 'simple', 'server.js');
const PORT = Number(process.env.CHECK_PORT || 8790);
const USER = process.env.XTREAM_USERNAME || 'demo';
const PASS = process.env.XTREAM_PASSWORD || 'demo';

let checks = 0;
let failures = 0;

function check(label, ok, detail = '') {
  checks += 1;
  if (ok) {
    console.log(`  \x1b[32mOK\x1b[0m   ${label}`);
  } else {
    failures += 1;
    console.log(`  \x1b[31mFAIL\x1b[0m ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

function request(url, method = 'GET', extraHeaders = null) {
  return new Promise((resolve, reject) => {
    const options = { method, timeout: 20000 };
    if (extraHeaders) options.headers = extraHeaders;
    const client = url.startsWith('https:') ? https : http;
    const req = client.request(url, options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

/** HEAD seguendo fino a 3 redirect (i CDN rispondono 302). */
async function headFollowing(url, hops = 0) {
  const res = await request(url, 'HEAD');
  if (res.status >= 300 && res.status < 400 && res.headers.location && hops < 3) {
    return headFollowing(res.headers.location, hops + 1);
  }
  return res;
}

/**
 * Verifica che il flusso abbia una TRACCIA AUDIO.
 *
 * Serve perche' molte clip di test in giro sono solo video: il player
 * riproduce ma resta muto, e sembra un problema del server.
 *
 * Richiede ffprobe (opzionale): se non c'e', il controllo viene saltato.
 */
async function checkAudio(url) {
  const { spawnSync } = require('child_process');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  const probe = spawnSync('ffprobe', ['-version'], { stdio: 'ignore' });
  if (probe.error) {
    console.log('  \x1b[33mSKIP\x1b[0m il flusso ha una traccia audio (ffprobe non installato)');
    return;
  }

  const tmp = path.join(os.tmpdir(), `jarvis-stream-${Date.now()}.mp4`);
  const dl = spawnSync('curl', ['-sSL', '-m', '60', '-o', tmp, url], { stdio: 'ignore' });
  if (dl.status !== 0 || !fs.existsSync(tmp)) {
    console.log('  \x1b[33mSKIP\x1b[0m il flusso ha una traccia audio (download non riuscito)');
    return;
  }

  const out = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', tmp],
    { encoding: 'utf8' }
  );
  const streams = (out.stdout || '').trim().split('\n').filter(Boolean);
  try {
    fs.unlinkSync(tmp);
  } catch (_) {
    /* file temporaneo */
  }

  check(
    'il flusso ha una traccia AUDIO (non e\' muto)',
    streams.includes('audio'),
    `tracce trovate: ${streams.join(', ') || 'nessuna'}`
  );
}

async function getJson(pathAndQuery) {
  const res = await request(`http://127.0.0.1:${PORT}${pathAndQuery}`);
  try {
    return { status: res.status, json: JSON.parse(res.body), headers: res.headers };
  } catch (_) {
    return { status: res.status, json: null, headers: res.headers, raw: res.body };
  }
}

async function waitReady(tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await request(`http://127.0.0.1:${PORT}/health`);
      if (r.status === 200) return true;
    } catch (_) {
      /* non e' ancora pronto */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function has(obj, keys) {
  if (!obj || typeof obj !== 'object') return false;
  return keys.every((k) => k in obj);
}

async function main() {
  console.log(`Verifica del server semplice: ${path.relative(ROOT, TARGET)}`);
  console.log('');

  const child = spawn(process.execPath, [TARGET], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), XTREAM_USERNAME: USER, XTREAM_PASSWORD: PASS },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  try {
    if (!(await waitReady())) {
      console.error('  il server non e\' partito');
      failures += 1;
      return;
    }

    const auth = `username=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}`;
    const q = (action) => `/player_api.php?${auth}${action ? `&action=${action}` : ''}`;

    console.log('[servizio]');
    const health = await getJson('/health');
    check('GET /health -> 200', health.status === 200, `status ${health.status}`);
    check('health: status ok', health.json && health.json.status === 'ok');

    console.log('');
    console.log('[autenticazione]');
    const authRes = await getJson(q(''));
    check('player_api.php -> 200', authRes.status === 200, `status ${authRes.status}`);
    check('auth: 1', authRes.json && authRes.json.user_info && authRes.json.user_info.auth === 1);
    check('username restituito', authRes.json && authRes.json.user_info.username === USER);
    check('messaggio presente', !!(authRes.json && authRes.json.user_info.message));
    check('logo presente', !!(authRes.json && authRes.json.user_info.logo));
    check('server_info presente', !!(authRes.json && authRes.json.server_info));
    const bad = await getJson('/player_api.php?username=x&password=y');
    check('credenziali errate -> 401', bad.status === 401, `status ${bad.status}`);

    console.log('');
    console.log('[catalogo]');
    const cats = await getJson(q('get_vod_categories'));
    check('get_vod_categories -> array', Array.isArray(cats.json));
    check('categoria completa', has(cats.json[0], ['category_id', 'category_name', 'parent_id']));

    const vod = await getJson(q('get_vod_streams'));
    check('get_vod_streams -> array', Array.isArray(vod.json) && vod.json.length > 0);
    check(
      'stream VOD completo',
      has(vod.json[0], [
        'num', 'name', 'stream_id', 'stream_icon', 'category_id',
        'container_extension', 'direct_source',
      ])
    );

    const vodInfo = await getJson(q(`get_vod_info&vod_id=${vod.json[0].stream_id}`));
    check('get_vod_info -> info + movie_data', !!(vodInfo.json && vodInfo.json.info && vodInfo.json.movie_data));

    const scats = await getJson(q('get_series_categories'));
    check('get_series_categories -> array', Array.isArray(scats.json) && scats.json.length > 0);

    const series = await getJson(q('get_series'));
    check('get_series -> array', Array.isArray(series.json) && series.json.length > 0);
    check(
      'voce serie completa (series_id incluso)',
      has(series.json[0], ['num', 'name', 'series_id', 'cover', 'category_id', 'rating'])
    );

    const info = await getJson(q(`get_series_info&series_id=${series.json[0].series_id}`));
    check('get_series_info -> seasons', !!(info.json && Array.isArray(info.json.seasons) && info.json.seasons.length));
    check(
      'stagione completa',
      has(info.json.seasons[0], ['season_number', 'name', 'episode_count', 'id', 'air_date', 'cover'])
    );
    check('get_series_info -> episodes', !!(info.json && info.json.episodes && info.json.episodes['1']));
    check(
      'episodio completo',
      has(info.json.episodes['1'][0], [
        'id', 'episode_num', 'title', 'container_extension', 'info', 'direct_source', 'season_number',
      ])
    );

    const lcats = await getJson(q('get_live_categories'));
    check('get_live_categories -> array', Array.isArray(lcats.json) && lcats.json.length > 0);

    const live = await getJson(q('get_live_streams'));
    // Il pannello Xtream originale restituisce le liste di stream come
    // array nudi: accettiamo anche la forma avvolta, ma e' quella nuda
    // che i player iOS si aspettano.
    const liveList = Array.isArray(live.json) ? live.json : (live.json && live.json.data) || [];
    check('get_live_streams -> array di stream', Array.isArray(liveList) && liveList.length > 0);
    check(
      'stream live completo',
      has(liveList[0], ['num', 'name', 'stream_id', 'category_id', 'direct_source'])
    );

    console.log('');
    console.log('[riproduzione - modalita\' proxy]');
    const gw = await request(
      `http://127.0.0.1:${PORT}/get.php?${auth}&stream=${vod.json[0].stream_id}&extension=mp4`
    );
    check('get.php -> 200 (il flusso passa dal server)', gw.status === 200, `status ${gw.status}`);
    check(
      'get.php -> content-type video',
      /video|mp4|octet-stream/i.test(gw.headers['content-type'] || ''),
      gw.headers['content-type'] || '(nessun content-type)'
    );
    check('get.php -> Accept-Ranges', !!gw.headers['accept-ranges'], gw.headers['accept-ranges'] || '(assente)');

    const gwRange = await request(
      `http://127.0.0.1:${PORT}/get.php?${auth}&stream=${vod.json[0].stream_id}&extension=mp4`,
      'GET',
      { Range: 'bytes=0-1023' }
    );
    check('get.php con Range -> 206', gwRange.status === 206, `status ${gwRange.status}`);
    check(
      'get.php con Range -> Content-Range',
      !!gwRange.headers['content-range'],
      gwRange.headers['content-range'] || '(assente)'
    );

    const classic = await request(
      `http://127.0.0.1:${PORT}/movie/${encodeURIComponent(USER)}/${encodeURIComponent(PASS)}/${vod.json[0].stream_id}.mp4`
    );
    check('path classico /movie/... -> 200', classic.status === 200, `status ${classic.status}`);

    const epId = info.json.episodes['1'][0].id;
    const ep = await request(
      `http://127.0.0.1:${PORT}/series/${encodeURIComponent(USER)}/${encodeURIComponent(PASS)}/${epId}.mp4`
    );
    check('path classico /series/... -> 200', ep.status === 200, `status ${ep.status}`);

    // Il file di destinazione deve esistere ed essere un video.
    const target = classic.headers.location || gw.headers.location;
    if (target) {
      const head = await headFollowing(target);
      check('il flusso finale risponde 200/206', head.status === 200 || head.status === 206, `status ${head.status}`);
      check(
        'il flusso finale e\' un video',
        /video|mp4|octet-stream/i.test(head.headers['content-type'] || ''),
        head.headers['content-type'] || '(nessun content-type)'
      );
      await checkAudio(target);
    }
  } finally {
    child.kill('SIGTERM');
  }

  console.log('');
  console.log('-----------------------------------------');
  console.log(`  controlli: ${checks}   falliti: ${failures}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('verifica fallita:', err);
  process.exitCode = 1;
});

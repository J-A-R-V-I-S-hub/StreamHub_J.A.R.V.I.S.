import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDatabase } from "../src/db/index.ts";
import { migrate } from "../src/db/migrate.ts";
import { hashPassword } from "../src/lib/password.ts";
import { parseM3u } from "../src/ingest/m3u.ts";
import { syncEntries } from "../src/ingest/sync.ts";
import { demoEntries, ensureDemoLine, readDemoSeed } from "../src/ingest/demo.ts";

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(here, "..", "src", "migrations");

const FIXTURE = `#EXTM3U
#EXTINF:-1 tvg-id="rai1.it" tvg-logo="http://logo/rai1.png" group-title="Rai",Rai 1
http://src/live/rai1.ts
#EXTINF:-1 tvg-id="rai2.it" group-title="Rai",Rai 2
#EXTVLCOPT:http-user-agent=VLC
http://src/live/rai2.m3u8
#EXTINF:-1 group-title="Film",Un film
http://src/vod/film.mp4
#EXTGRP:Documentari
#EXTINF:-1,Un documentario
http://src/vod/doc.mkv
#EXTINF:0,Senza gruppo
http://src/live/altro.ts
`;

test("parser: attributi, gruppi, EXTVLCOPT, classificazione", () => {
  const entries = parseM3u(FIXTURE);
  assert.equal(entries.length, 5);

  assert.equal(entries[0].name, "Rai 1");
  assert.equal(entries[0].group, "Rai");
  assert.equal(entries[0].logo, "http://logo/rai1.png");
  assert.equal(entries[0].tvgId, "rai1.it");
  assert.equal(entries[0].kind, "live");

  // #EXTVLCOPT viene saltato e non interrompe la coppia EXTINF/URL
  assert.equal(entries[1].url, "http://src/live/rai2.m3u8");
  assert.equal(entries[1].kind, "live");

  assert.equal(entries[2].kind, "movie");
  assert.equal(entries[2].group, "Film");

  // #EXTGRP sovrascrive il gruppo assente
  assert.equal(entries[3].group, "Documentari");
  assert.equal(entries[3].kind, "movie");

  // nome vuoto -> ripiego, gruppo assente -> "Altro"
  assert.equal(entries[4].name, "Senza gruppo");
  assert.equal(entries[4].group, "Altro");
});

test("parser: testo spazzatura -> nessuna voce", () => {
  assert.deepEqual(parseM3u(""), []);
  assert.deepEqual(parseM3u("ciao\nmondo"), []);
});

function freshDb() {
  const db = openDatabase(":memory:");
  migrate(db, MIGRATIONS);
  return db;
}

function addLine(db: ReturnType<typeof freshDb>) {
  const userId = randomUUID();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, plan, plan_expires_at, created_at) VALUES (?, ?, ?, 'admin', 'lifetime', NULL, ?)"
  ).run(userId, "a@test.it", hashPassword("x"), new Date().toISOString());
  const lineId = randomUUID();
  db.prepare(
    `INSERT INTO lines (id, user_id, name, xtream_username, xtream_password, status, max_connections, expires_at, created_at)
     VALUES (?, ?, 'L', 'u1', 'p1', 'active', 1, NULL, ?)`
  ).run(lineId, userId, new Date().toISOString());
  return { userId, lineId };
}

test("sync: conta giusto, categorie, id numerici", () => {
  const db = freshDb();
  const { lineId } = addLine(db);

  const result = syncEntries(db, lineId, parseM3u(FIXTURE));
  assert.deepEqual(result, { lineId, live: 3, movies: 2, categories: 4 });

  const live = db.prepare("SELECT * FROM streams WHERE line_id = ? ORDER BY stream_id").all(lineId);
  assert.equal(live.length, 3);
  assert.equal((live[0] as { stream_id: number }).stream_id, 1);

  const movies = db.prepare("SELECT * FROM movies WHERE line_id = ? ORDER BY stream_id").all(lineId);
  assert.equal(movies.length, 2);
  // gli id del VOD partono da 1000 e restano separati dai live
  assert.equal((movies[0] as { stream_id: number }).stream_id, 1000);
});

test("sync: rilanciato sostituisce, non duplica", () => {
  const db = freshDb();
  const { lineId } = addLine(db);
  syncEntries(db, lineId, parseM3u(FIXTURE));
  syncEntries(db, lineId, parseM3u(FIXTURE));

  const count = (t: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE line_id = ?`).get(lineId) as { n: number }).n;
  assert.equal(count("streams"), 3);
  assert.equal(count("movies"), 2);
  assert.equal(count("categories"), 4);
});

test("sync: catalogo vuoto non lascia residui", () => {
  const db = freshDb();
  const { lineId } = addLine(db);
  syncEntries(db, lineId, parseM3u(FIXTURE));
  syncEntries(db, lineId, []);
  const n = db.prepare("SELECT COUNT(*) AS n FROM movies WHERE line_id = ?").get(lineId) as { n: number };
  assert.equal(n.n, 0);
});

test("demo: il catalogo viene da un file di dati, non dal codice", () => {
  const seed = readDemoSeed();
  assert.ok(seed, "il file di seed deve esistere");
  assert.ok(seed!.voci.length >= 1);

  // niente contenuti protetti e niente formati che la TV non legge
  for (const v of seed!.voci) {
    assert.match(v.url, /^https:\/\/(download\.blender\.org|archive\.org)\//);
    assert.match(v.url, /\.mp4$/);
  }
});

test("demo: creata una volta sola, con i film dentro", () => {
  const db = freshDb();
  const { userId } = addLine(db);
  const seed = readDemoSeed()!;

  ensureDemoLine(db, userId);
  ensureDemoLine(db, userId);

  const lines = db.prepare("SELECT * FROM lines WHERE user_id = ?").all(userId) as Array<{
    id: string;
    name: string;
  }>;
  assert.equal(lines.length, 2); // la linea di test + la demo
  const demo = lines.find((l) => l.name.startsWith("Demo"));
  assert.ok(demo);

  const movies = db.prepare("SELECT * FROM movies WHERE line_id = ?").all(demo!.id);
  assert.equal(movies.length, seed.voci.length);


});

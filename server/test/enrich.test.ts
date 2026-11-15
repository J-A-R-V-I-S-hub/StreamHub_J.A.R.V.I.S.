import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDatabase } from "../src/db/index.ts";
import { migrate } from "../src/db/migrate.ts";
import { normalizeTitle, enrichLine, type TmdbClient } from "../src/enrich/tmdb.ts";

const here = dirname(fileURLToPath(import.meta.url));

test("normalizeTitle: accenti, articoli, punteggiatura", () => {
  assert.equal(normalizeTitle("Il Padrino"), "padrino");
  assert.equal(normalizeTitle("The Matrix"), "matrix");
  assert.equal(normalizeTitle("Amélie!"), "amelie");
  assert.equal(normalizeTitle("  Blade   Runner  "), "blade runner");
});

function dbWithMovie(name: string, year: number | null) {
  const db = openDatabase(":memory:");
  migrate(db, join(here, "..", "src", "migrations"));
  const userId = randomUUID();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, plan, plan_expires_at, created_at) VALUES (?, 'a@t.it', 'x', 'admin', 'lifetime', NULL, ?)"
  ).run(userId, new Date().toISOString());
  const lineId = randomUUID();
  db.prepare(
    "INSERT INTO lines (id, user_id, name, xtream_username, xtream_password, status, max_connections, expires_at, created_at) VALUES (?, ?, 'L', 'u', 'p', 'active', 1, NULL, ?)"
  ).run(lineId, userId, new Date().toISOString());
  db.prepare(
    "INSERT INTO movies (id, line_id, name, url, stream_id, year) VALUES (?, ?, ?, 'http://src/x.mp4', 1000, ?)"
  ).run(randomUUID(), lineId, name, year);
  return { db, lineId };
}

test("senza client: nessun arricchimento, ma nessun errore", async () => {
  const { db, lineId } = dbWithMovie("Sintel", 2010);
  const report = await enrichLine(db, lineId, null);
  assert.deepEqual(report, { examined: 0, matched: 0, skipped: true });
});

test("con client: scrive tmdb_id, poster, trama, anno, voto", async () => {
  const { db, lineId } = dbWithMovie("Sintel", 2010);
  const fake: TmdbClient = {
    async searchMovie() {
      return {
        tmdb_id: 45745,
        poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
        plot: "Una ragazza cerca il suo drago.",
        year: 2010,
        rating: 7.4,
      };
    },
  };
  const report = await enrichLine(db, lineId, fake);
  assert.deepEqual(report, { examined: 1, matched: 1, skipped: false });

  const row = db.prepare("SELECT * FROM movies WHERE line_id = ?").get(lineId) as {
    tmdb_id: number;
    icon: string;
    plot: string;
    rating: number;
  };
  assert.equal(row.tmdb_id, 45745);
  assert.equal(row.icon, "https://image.tmdb.org/t/p/w500/poster.jpg");
  assert.equal(row.plot, "Una ragazza cerca il suo drago.");
  assert.equal(row.rating, 7.4);
});

test("client che non trova nulla: il film resta com'è", async () => {
  const { db, lineId } = dbWithMovie("Film Sconosciuto", null);
  const fake: TmdbClient = { async searchMovie() { return null; } };
  const report = await enrichLine(db, lineId, fake);
  assert.equal(report.examined, 1);
  assert.equal(report.matched, 0);
  const row = db.prepare("SELECT tmdb_id FROM movies WHERE line_id = ?").get(lineId) as {
    tmdb_id: number | null;
  };
  assert.equal(row.tmdb_id, null);
});

test("non arricchisce due volte lo stesso film", async () => {
  const { db, lineId } = dbWithMovie("Sintel", 2010);
  let calls = 0;
  const fake: TmdbClient = {
    async searchMovie() {
      calls++;
      return { tmdb_id: 1, poster: "", plot: "", year: 2010, rating: 1 };
    },
  };
  await enrichLine(db, lineId, fake);
  await enrichLine(db, lineId, fake);
  assert.equal(calls, 1);
});

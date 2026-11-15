import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDatabase } from "../src/db/index.ts";
import { migrate } from "../src/db/migrate.ts";
import { hashPassword } from "../src/lib/password.ts";
import { createApp } from "../src/app.ts";
import type { Config } from "../src/config.ts";

const here = dirname(fileURLToPath(import.meta.url));

const config: Config = {
  nodeEnv: "test",
  port: 0,
  host: "127.0.0.1",
  publicUrl: "http://test.local",
  databasePath: ":memory:",
  sessionTtlDays: 30,
  adminEmail: "admin@local.it",
  adminPassword: "",
  logLevel: "silent",
};

function setup() {
  const db = openDatabase(":memory:");
  migrate(db, join(here, "..", "src", "migrations"));
  const app = createApp({ db, config });

  const userId = randomUUID();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, plan, plan_expires_at, created_at) VALUES (?, ?, ?, 'user', 'trial', NULL, ?)"
  ).run(userId, "a@test.it", hashPassword("x"), new Date().toISOString());

  const lineId = randomUUID();
  db.prepare(
    `INSERT INTO lines (id, user_id, name, xtream_username, xtream_password, status, max_connections, expires_at, created_at)
     VALUES (?, ?, 'TV', 'utente1', 'pass1', 'active', 2, NULL, ?)`
  ).run(lineId, userId, new Date().toISOString());

  return { app, db, lineId };
}

const AUTH = "username=utente1&password=pass1";

test("credenziali sbagliate -> 401 con la forma attesa dal player", async () => {
  const { app } = setup();
  const res = await app.inject({ method: "GET", url: `/player_api.php?username=utente1&password=no` });
  assert.equal(res.statusCode, 401);
  const body = res.json();
  assert.equal(body.user_info.auth, 0);
  assert.equal(body.user_info.status, "Disabled");
  await app.close();
});

test("auth corretta -> user_info + server_info con i campi che il client legge", async () => {
  const { app } = setup();
  const res = await app.inject({ method: "GET", url: `/player_api.php?${AUTH}` });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.user_info.auth, 1);
  assert.equal(body.user_info.status, "Active");
  assert.equal(body.user_info.username, "utente1");
  assert.equal(body.user_info.max_connections, "2");
  // senza mp4 alcuni player nascondono tutto il VOD
  assert.ok(body.user_info.allowed_output_formats.includes("mp4"));
  assert.equal(body.server_info.server_protocol, "http");
  assert.equal(body.server_info.url, "test.local");
  assert.equal(body.server_info.port, "80");
  assert.ok(typeof body.server_info.timestamp_now === "number");
  await app.close();
});

test("catalogo vuoto: le liste sono ARRAY NUDI, non oggetti", async () => {
  const { app } = setup();
  for (const action of ["get_live_streams", "get_vod_streams", "get_series"]) {
    const res = await app.inject({ method: "GET", url: `/player_api.php?${AUTH}&action=${action}` });
    assert.equal(res.statusCode, 200, action);
    assert.ok(Array.isArray(res.json()), `${action} deve essere un array nudo`);
  }
  for (const action of ["get_live_categories", "get_vod_categories", "get_series_categories"]) {
    const res = await app.inject({ method: "GET", url: `/player_api.php?${AUTH}&action=${action}` });
    assert.ok(Array.isArray(res.json()), `${action} deve essere un array nudo`);
  }
  await app.close();
});

test("serie inesistente -> seasons/info/episodes vuoti, non un errore", async () => {
  const { app } = setup();
  const res = await app.inject({
    method: "GET",
    url: `/player_api.php?${AUTH}&action=get_series_info&series_id=999`,
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { seasons: [], info: {}, episodes: {} });
  await app.close();
});

test("vod inesistente -> {}", async () => {
  const { app } = setup();
  const res = await app.inject({ method: "GET", url: `/player_api.php?${AUTH}&action=get_vod_info&vod_id=1` });
  assert.deepEqual(res.json(), {});
  await app.close();
});

test("catalogo pieno: film, live, serie con series_id numerico", async () => {
  const { app, db, lineId } = setup();
  const catId = randomUUID();
  db.prepare("INSERT INTO categories (id, line_id, type, name, sort) VALUES (?, ?, 'vod', 'Film', 0)").run(catId, lineId);
  db.prepare(
    "INSERT INTO movies (id, line_id, category_id, name, url, icon, plot, year, rating, stream_id) VALUES (?, ?, ?, 'Film Uno', 'http://src/1.mp4', '/p.jpg', 'Trama', 2020, 8, 1101)"
  ).run(randomUUID(), lineId, catId);
  db.prepare(
    "INSERT INTO streams (id, line_id, category_id, name, url, icon, epg_id, stream_id) VALUES (?, ?, NULL, 'Canale 1', 'http://src/1.ts', NULL, 'ch1', 1)"
  ).run(randomUUID(), lineId);
  db.prepare(
    "INSERT INTO series (id, line_id, category_id, name, cover, plot, year, rating, series_id) VALUES (?, ?, NULL, 'Serie Uno', '/c.jpg', 'Trama', 2019, 7.5, 2001)"
  ).run("s1", lineId);

  const vod = (await app.inject({ method: "GET", url: `/player_api.php?${AUTH}&action=get_vod_streams` })).json();
  assert.equal(vod.length, 1);
  assert.equal(vod[0].stream_id, 1101);
  assert.equal(vod[0].stream_type, "movie");
  assert.equal(vod[0].container_extension, "mp4");
  // icona relativa -> URL assoluto
  assert.equal(vod[0].stream_icon, "http://test.local/p.jpg");

  const live = (await app.inject({ method: "GET", url: `/player_api.php?${AUTH}&action=get_live_streams` })).json();
  assert.equal(live[0].stream_type, "live");
  assert.equal(live[0].epg_channel_id, "ch1");

  const series = (await app.inject({ method: "GET", url: `/player_api.php?${AUTH}&action=get_series` })).json();
  assert.equal(series[0].series_id, 2001);
  assert.equal(series[0].id, 2001);

  const info = (await app.inject({ method: "GET", url: `/player_api.php?${AUTH}&action=get_vod_info&vod_id=1101` })).json();
  assert.equal(info.info.name, "Film Uno");
  assert.equal(info.movie_data.stream_id, 1101);
  await app.close();
});

test("serie con stagioni ed episodi", async () => {
  const { app, db, lineId } = setup();
  db.prepare(
    "INSERT INTO series (id, line_id, category_id, name, cover, plot, year, rating, series_id) VALUES ('s1', ?, NULL, 'Serie', '', '', 2021, 8, 2001)"
  ).run(lineId);
  db.prepare(
    "INSERT INTO episodes (id, series_id, season, num, name, url, icon, plot, duration, stream_id) VALUES ('e1','s1',1,1,'Ep 1','http://src/e1.mp4','', '', NULL, 3001)"
  ).run();
  db.prepare(
    "INSERT INTO episodes (id, series_id, season, num, name, url, icon, plot, duration, stream_id) VALUES ('e2','s1',1,2,'Ep 2','http://src/e2.mp4','', '', NULL, 3002)"
  ).run();

  const body = (await app.inject({ method: "GET", url: `/player_api.php?${AUTH}&action=get_series_info&series_id=2001` })).json();
  assert.equal(body.seasons.length, 1);
  assert.equal(body.seasons[0].episode_count, 2);
  assert.equal(body.episodes["1"].length, 2);
  assert.equal(body.episodes["1"][0].id, 3001);
  assert.equal(body.info.series_id, 2001);
  await app.close();
});

test("path classico /movie/user/pass/id.mp4 -> 302 verso la sorgente", async () => {
  const { app, db, lineId } = setup();
  db.prepare(
    "INSERT INTO movies (id, line_id, category_id, name, url, icon, stream_id) VALUES (?, ?, NULL, 'F', 'http://src/f.mp4', '', 1101)"
  ).run(randomUUID(), lineId);

  const res = await app.inject({ method: "GET", url: "/movie/utente1/pass1/1101.mp4" });
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, "http://src/f.mp4");
  await app.close();
});

test("get.php con stream valido -> 302; stream inesistente -> 404", async () => {
  const { app, db, lineId } = setup();
  db.prepare(
    "INSERT INTO movies (id, line_id, category_id, name, url, icon, stream_id) VALUES (?, ?, NULL, 'F', 'http://src/f.mp4', '', 1101)"
  ).run(randomUUID(), lineId);

  const ok = await app.inject({ method: "GET", url: `/get.php?${AUTH}&stream=1101&extension=mp4` });
  assert.equal(ok.statusCode, 302);

  const ko = await app.inject({ method: "GET", url: `/get.php?${AUTH}&stream=9999` });
  assert.equal(ko.statusCode, 404);
  await app.close();
});

test("epg: XML valido, con canale e programma", async () => {
  const { app, db, lineId } = setup();
  db.prepare(
    "INSERT INTO streams (id, line_id, category_id, name, url, icon, epg_id, stream_id) VALUES (?, ?, NULL, 'Canale 1', 'http://src/1.ts', NULL, 'ch1', 1)"
  ).run(randomUUID(), lineId);

  const res = await app.inject({ method: "GET", url: `/xmltv.php?${AUTH}` });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"] as string, /xml/);
  assert.match(res.body, /<tv generator-info-name=/);
  assert.match(res.body, /<channel id="ch1">/);
  assert.match(res.body, /<programme start=/);
  await app.close();
});

test("logo.svg servito come immagine", async () => {
  const { app } = setup();
  const res = await app.inject({ method: "GET", url: "/logo.svg" });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"] as string, /svg/);
  assert.match(res.body, /<svg/);
  await app.close();
});

test("linea scaduta -> 401", async () => {
  const { app, db } = setup();
  db.prepare("UPDATE lines SET expires_at = ? WHERE xtream_username = 'utente1'").run(
    new Date(Date.now() - 86400000).toISOString()
  );
  const res = await app.inject({ method: "GET", url: `/player_api.php?${AUTH}` });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("linea disattivata -> 401", async () => {
  const { app, db } = setup();
  db.prepare("UPDATE lines SET status = 'disabled' WHERE xtream_username = 'utente1'").run();
  const res = await app.inject({ method: "GET", url: `/player_api.php?${AUTH}` });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("container_extension segue il file vero, non è sempre mp4", async () => {
  const { app, db, lineId } = setup();
  db.prepare(
    "INSERT INTO movies (id, line_id, name, url, stream_id) VALUES (?, ?, 'Avi', 'http://src/x.avi', 1000)"
  ).run(randomUUID(), lineId);
  db.prepare(
    "INSERT INTO movies (id, line_id, name, url, stream_id) VALUES (?, ?, 'Mkv', 'http://src/y.mkv', 1001)"
  ).run(randomUUID(), lineId);

  const list = (await app.inject({ method: "GET", url: `/player_api.php?${AUTH}&action=get_vod_streams` })).json();
  const byId = Object.fromEntries(list.map((m: { stream_id: number; container_extension: string }) => [m.stream_id, m.container_extension]));
  assert.equal(byId[1000], "avi");
  assert.equal(byId[1001], "mkv");

  const info = (await app.inject({ method: "GET", url: `/player_api.php?${AUTH}&action=get_vod_info&vod_id=1000` })).json();
  assert.equal(info.movie_data.container_extension, "avi");
  await app.close();
});

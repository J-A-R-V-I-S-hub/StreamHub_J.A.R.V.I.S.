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

function makeApp() {
  const db = openDatabase(":memory:");
  migrate(db, join(here, "..", "src", "migrations"));
  const app = createApp({ db, config });
  return { app, db };
}

function addUser(db: ReturnType<typeof openDatabase>, email: string, password: string) {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, plan, plan_expires_at, created_at) VALUES (?, ?, ?, 'user', 'trial', NULL, ?)"
  ).run(id, email, hashPassword(password), new Date().toISOString());
  return id;
}

test("health risponde", async () => {
  const { app } = makeApp();
  const res = await app.inject({ method: "GET", url: "/health" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, "ok");
  await app.close();
});

test("login con password sbagliata -> 401", async () => {
  const { app, db } = makeApp();
  addUser(db, "a@test.it", "segreta123");
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@test.it", password: "sbagliata" },
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, "invalid_credentials");
  await app.close();
});

test("login corretto -> token e /api/me", async () => {
  const { app, db } = makeApp();
  addUser(db, "a@test.it", "segreta123");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@test.it", password: "segreta123" },
  });
  assert.equal(login.statusCode, 200);
  const token = login.json().token;
  assert.ok(token && token.length >= 32);

  const me = await app.inject({
    method: "GET",
    url: "/api/me",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().user.email, "a@test.it");
  await app.close();
});

test("senza token -> 401", async () => {
  const { app } = makeApp();
  const res = await app.inject({ method: "GET", url: "/api/lines" });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("creo linea, la leggo, ho i 4 campi", async () => {
  const { app, db } = makeApp();
  addUser(db, "a@test.it", "segreta123");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@test.it", password: "segreta123" },
  });
  const auth = { authorization: `Bearer ${login.json().token}` };

  const created = await app.inject({
    method: "POST",
    url: "/api/lines",
    headers: auth,
    payload: { name: "La mia TV" },
  });
  assert.equal(created.statusCode, 201);
  const line = created.json();
  assert.equal(line.name, "La mia TV");
  assert.ok(line.xtream_username.startsWith("u"));

  const list = await app.inject({ method: "GET", url: "/api/lines", headers: auth });
  assert.equal(list.json().lines.length, 1);

  const connect = await app.inject({
    method: "GET",
    url: `/api/lines/${line.id}/connect`,
    headers: auth,
  });
  assert.equal(connect.statusCode, 200);
  const c = connect.json();
  assert.deepEqual(Object.keys(c).sort(), [
    "password",
    "playlist_name",
    "playlist_url",
    "username",
  ]);
  assert.equal(c.playlist_url, "http://test.local");
  await app.close();
});

test("isolamento: un altro utente non vede la mia linea (404)", async () => {
  const { app, db } = makeApp();
  addUser(db, "a@test.it", "segreta123");
  addUser(db, "b@test.it", "altra12345");

  async function tokenOf(email: string, password: string) {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${r.json().token}` };
  }

  const a = await tokenOf("a@test.it", "segreta123");
  const b = await tokenOf("b@test.it", "altra12345");

  const line = (
    await app.inject({ method: "POST", url: "/api/lines", headers: a, payload: { name: "A" } })
  ).json();

  const peek = await app.inject({ method: "GET", url: `/api/lines/${line.id}`, headers: b });
  assert.equal(peek.statusCode, 404);

  const peekConnect = await app.inject({
    method: "GET",
    url: `/api/lines/${line.id}/connect`,
    headers: b,
  });
  assert.equal(peekConnect.statusCode, 404);

  const listB = await app.inject({ method: "GET", url: "/api/lines", headers: b });
  assert.equal(listB.json().lines.length, 0);
  await app.close();
});

test("elimino la linea -> 204 e poi 404", async () => {
  const { app, db } = makeApp();
  addUser(db, "a@test.it", "segreta123");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@test.it", password: "segreta123" },
  });
  const auth = { authorization: `Bearer ${login.json().token}` };

  const line = (
    await app.inject({ method: "POST", url: "/api/lines", headers: auth, payload: { name: "X" } })
  ).json();

  const del = await app.inject({ method: "DELETE", url: `/api/lines/${line.id}`, headers: auth });
  assert.equal(del.statusCode, 204);

  const after = await app.inject({ method: "GET", url: `/api/lines/${line.id}`, headers: auth });
  assert.equal(after.statusCode, 404);
  await app.close();
});

test("migrazioni: applicate una volta sola e idempotenti", async () => {
  const db = openDatabase(":memory:");
  const dir = join(here, "..", "src", "migrations");
  const first = migrate(db, dir);
  assert.ok(first.length >= 1);
  const second = migrate(db, dir);
  assert.equal(second.length, 0);
});

test("password: hash e verifica", async () => {
  const { hashPassword, verifyPassword } = await import("../src/lib/password.ts");
  const h = hashPassword("ciao");
  assert.ok(h.startsWith("scrypt$"));
  assert.equal(verifyPassword("ciao", h), true);
  assert.equal(verifyPassword("no", h), false);
});

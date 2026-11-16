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
const config = {
  nodeEnv: "test", port: 0, host: "127.0.0.1", serverUrl: "http://test.local",
  databasePath: ":memory:", sessionTtlDays: 30, adminEmail: "admin@local.it",
  adminPassword: "", logLevel: "silent", tmdbApiKey: "", tmdbLanguage: "it-IT",
  tmdbCachePath: "", dataDir: "",
} as Config;

function setup() {
  const db = openDatabase(":memory:");
  migrate(db, join(here, "..", "src", "migrations"));
  const app = createApp({ db, config });
  return { app, db };
}

function addUser(
  db: ReturnType<typeof setup>["db"],
  email: string,
  opts: { role?: string; plan?: string; expires?: string | null } = {}
) {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, plan, plan_expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    email,
    hashPassword("password123"),
    opts.role ?? "user",
    opts.plan ?? "trial",
    opts.expires ?? null,
    new Date().toISOString()
  );
  return id;
}

async function login(app: ReturnType<typeof setup>["app"], email: string) {
  const res = await app.inject({
    method: "POST", url: "/api/auth/login",
    payload: { email, password: "password123" },
  });
  return { authorization: `Bearer ${res.json().token}` };
}

test("piano scaduto -> 403 plan_expired", async () => {
  const { app, db } = setup();
  addUser(db, "scaduto@test.it", { expires: new Date(Date.now() - 86400000).toISOString() });
  const auth = await login(app, "scaduto@test.it");
  const res = await app.inject({ method: "GET", url: "/api/lines", headers: auth });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "plan_expired");
  await app.close();
});

test("lifetime senza scadenza -> accesso consentito", async () => {
  const { app, db } = setup();
  addUser(db, "life@test.it", { plan: "lifetime", expires: null });
  const auth = await login(app, "life@test.it");
  const res = await app.inject({ method: "GET", url: "/api/lines", headers: auth });
  assert.equal(res.statusCode, 200);
  await app.close();
});

test("limite linee del piano trial: la seconda viene rifiutata", async () => {
  const { app, db } = setup();
  addUser(db, "trial@test.it", { plan: "trial" });
  const auth = await login(app, "trial@test.it");

  const first = await app.inject({
    method: "POST", url: "/api/lines", headers: auth, payload: { name: "Una" },
  });
  assert.equal(first.statusCode, 201);

  const second = await app.inject({
    method: "POST", url: "/api/lines", headers: auth, payload: { name: "Due" },
  });
  assert.equal(second.statusCode, 403);
  assert.equal(second.json().error, "line_limit");
  assert.match(second.json().message, /trial/);
  await app.close();
});

test("admin: elenco utenti e cambio piano", async () => {
  const { app, db } = setup();
  addUser(db, "admin@test.it", { role: "admin", plan: "lifetime" });
  const target = addUser(db, "cliente@test.it", { plan: "trial" });
  const auth = await login(app, "admin@test.it");

  const list = await app.inject({ method: "GET", url: "/api/admin/users", headers: auth });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().users.length, 2);

  const set = await app.inject({
    method: "PUT", url: `/api/admin/users/${target}/plan`, headers: auth,
    payload: { plan: "base", days: 30 },
  });
  assert.equal(set.statusCode, 200);
  assert.equal(set.json().plan, "base");

  const row = db.prepare("SELECT plan, plan_expires_at FROM users WHERE id = ?").get(target) as {
    plan: string; plan_expires_at: string;
  };
  assert.equal(row.plan, "base");
  assert.ok(new Date(row.plan_expires_at).getTime() > Date.now());
  await app.close();
});

test("un utente normale non entra in /api/admin", async () => {
  const { app, db } = setup();
  addUser(db, "u@test.it", { role: "user" });
  const auth = await login(app, "u@test.it");
  const res = await app.inject({ method: "GET", url: "/api/admin/users", headers: auth });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test("registrazione chiusa di default", async () => {
  const { app } = setup();
  delete process.env.ALLOW_REGISTRATION;
  const res = await app.inject({
    method: "POST", url: "/api/auth/register",
    payload: { email: "nuovo@test.it", password: "password123" },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "registration_disabled");
  await app.close();
});

test("registrazione aperta: crea trial con scadenza", async () => {
  const { app, db } = setup();
  process.env.ALLOW_REGISTRATION = "1";
  try {
    const res = await app.inject({
      method: "POST", url: "/api/auth/register",
      payload: { email: "nuovo@test.it", password: "password123" },
    });
    assert.equal(res.statusCode, 201);
    const row = db.prepare("SELECT plan, plan_expires_at FROM users WHERE email = ?").get("nuovo@test.it") as {
      plan: string; plan_expires_at: string;
    };
    assert.equal(row.plan, "trial");
    assert.ok(new Date(row.plan_expires_at).getTime() > Date.now());

    const again = await app.inject({
      method: "POST", url: "/api/auth/register",
      payload: { email: "nuovo@test.it", password: "password123" },
    });
    assert.equal(again.statusCode, 409);
  } finally {
    delete process.env.ALLOW_REGISTRATION;
  }
  await app.close();
});

test("registrazione: password troppo corta rifiutata", async () => {
  const { app } = setup();
  process.env.ALLOW_REGISTRATION = "1";
  try {
    const res = await app.inject({
      method: "POST", url: "/api/auth/register",
      payload: { email: "x@test.it", password: "corta" },
    });
    assert.equal(res.statusCode, 400);
  } finally {
    delete process.env.ALLOW_REGISTRATION;
  }
  await app.close();
});

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { loadConfig } from "./config.ts";
import { openDatabase } from "./db/index.ts";
import { migrate } from "./db/migrate.ts";
import { hashPassword, verifyPassword } from "./lib/password.ts";
import { createApp } from "./app.ts";
import { ensureDemoLine } from "./ingest/demo.ts";

/** Al primo avvio crea l'admin. Se la password non è nel .env, ne genera una e la dice UNA volta. */
function ensureAdmin(db: ReturnType<typeof openDatabase>, config: ReturnType<typeof loadConfig>) {
  const existing = db
    .prepare("SELECT id, email, password_hash FROM users WHERE role = 'admin' LIMIT 1")
    .get() as { id: string; email: string; password_hash: string } | undefined;

  // Se l'admin esiste già ma la password nel .env è diversa, vince il .env.
  // Così la password è sempre recuperabile: non si perde più nei log.
  if (existing) {
    if (config.adminPassword && !verifyPassword(config.adminPassword, existing.password_hash)) {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
        hashPassword(config.adminPassword),
        existing.id
      );
      console.log(`[bootstrap] password dell'admin aggiornata da ADMIN_PASSWORD (${existing.email})`);
    }
    return;
  }

  let password = config.adminPassword;
  let generated = false;
  if (!password) {
    password = randomBytes(12).toString("base64url");
    generated = true;
  }

  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, plan, plan_expires_at, created_at) VALUES (?, ?, ?, 'admin', 'lifetime', NULL, ?)"
  ).run(randomUUID(), config.adminEmail, hashPassword(password), new Date().toISOString());

  console.log(`[bootstrap] admin creato: ${config.adminEmail}`);
  if (generated) {
    console.log(`[bootstrap] password generata (cambiala nel .env): ${password}`);
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();

mkdirSync(dirname(config.databasePath), { recursive: true });
const db = openDatabase(config.databasePath);

const applied = migrate(db, join(here, "migrations"));
if (applied.length) console.log(`[db] migrazioni applicate: ${applied.join(", ")}`);

ensureAdmin(db, config);

const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as
  | { id: string }
  | undefined;
if (admin) ensureDemoLine(db, admin.id);

const app = createApp({ db, config });
app.listen({ port: config.port, host: config.host }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`[server] in ascolto su ${address} — pubblico: ${config.publicUrl}`);
});

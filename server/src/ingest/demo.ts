import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { Db } from "../db/index.ts";
import type { M3uEntry } from "./m3u.ts";
import { syncEntries } from "./sync.ts";

type SeedVoice = { name: string; url: string; group?: string; kind?: "movie" | "live" };
type SeedFile = { nomeLinea?: string; voci: SeedVoice[] };

const DEFAULT_SEED = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "seed", "demo-classics.json");

/**
 * Legge il catalogo demo da un file di DATI, non dal codice.
 * - `SEED_DEMO=0` lo disattiva del tutto
 * - `DEMO_SEED_FILE` punta a un altro file (es. una vostra playlist)
 * Il catalogo vero vive comunque nel database: questo serve solo al primo avvio.
 */
export function readDemoSeed(path = process.env.DEMO_SEED_FILE || DEFAULT_SEED): SeedFile | null {
  if ((process.env.SEED_DEMO ?? "1") === "0") return null;
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as SeedFile;
    if (!Array.isArray(parsed.voci) || parsed.voci.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function demoEntries(seed: SeedFile): M3uEntry[] {
  return seed.voci.map((v) => ({
    name: v.name,
    url: v.url,
    group: v.group ?? "Demo",
    logo: "",
    tvgId: "",
    kind: v.kind ?? "movie",
  }));
}

/** Crea (solo se manca) la linea demo dell'admin, con il catalogo del file di seed. */
export function ensureDemoLine(db: Db, adminId: string): void {
  const seed = readDemoSeed();
  if (!seed) return;

  // Credenziali fisse in sviluppo: se sono nel .env, la linea demo le usa sempre.
  // Nel codice non c'è nessun valore: il .env è gitignored.
  const fixedUser = (process.env.DEMO_LINE_USER ?? "").trim();
  const fixedPass = (process.env.DEMO_LINE_PASS ?? "").trim();

  const existing = db
    .prepare("SELECT id, xtream_username, xtream_password FROM lines WHERE user_id = ? AND name LIKE 'Demo%' LIMIT 1")
    .get(adminId) as { id: string; xtream_username: string; xtream_password: string } | undefined;

  if (existing) {
    // Se il .env dice altre credenziali, vince il .env: così la TV non va riconfigurata.
    if (fixedUser && fixedPass && (existing.xtream_username !== fixedUser || existing.xtream_password !== fixedPass)) {
      try {
        db.prepare("UPDATE lines SET xtream_username = ?, xtream_password = ? WHERE id = ?").run(
          fixedUser,
          fixedPass,
          existing.id
        );
        console.log("[demo] credenziali della linea demo allineate al .env");
      } catch {
        console.log("[demo] impossibile allineare le credenziali (username già in uso)");
      }
    }
    return;
  }

  const lineId = randomUUID();
  db.prepare(
    `INSERT INTO lines (id, user_id, name, xtream_username, xtream_password, status, max_connections, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', 2, NULL, ?)`
  ).run(
    lineId,
    adminId,
    seed.nomeLinea ?? "Demo",
    fixedUser || "demo" + randomUUID().slice(0, 6),
    fixedPass || randomUUID().replace(/-/g, "").slice(0, 12),
    new Date().toISOString()
  );

  syncEntries(db, lineId, demoEntries(seed));
}

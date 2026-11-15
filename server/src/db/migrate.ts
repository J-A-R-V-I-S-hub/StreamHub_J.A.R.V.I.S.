import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./index.ts";

/**
 * Applica le migrazioni numerate in ordine, una transazione per file.
 * Una migrazione già applicata non si tocca: se ne aggiunge una nuova.
 */
export function migrate(db: Db, dir: string): string[] {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
  );
  const done = new Set(
    db.prepare("SELECT name FROM _migrations").all().map((r) => String((r as { name: string }).name))
  );
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const applied: string[] = [];

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
        file,
        new Date().toISOString()
      );
      db.exec("COMMIT");
      applied.push(file);
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`migrazione ${file} fallita: ${(err as Error).message}`);
    }
  }
  return applied;
}

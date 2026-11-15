import { randomUUID } from "node:crypto";
import type { Db } from "../db/index.ts";
import type { M3uEntry } from "./m3u.ts";

const VOD_BASE = 1000;
const SERIES_BASE = 2000;

export type SyncResult = {
  lineId: string;
  live: number;
  movies: number;
  categories: number;
};

/**
 * Scrive il catalogo di una linea in una sola transazione:
 * se qualcosa va storto il catalogo precedente resta valido.
 */
export function syncEntries(db: Db, lineId: string, entries: M3uEntry[]): SyncResult {
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM episodes WHERE series_id IN (SELECT id FROM series WHERE line_id = ?)").run(lineId);
    db.prepare("DELETE FROM series WHERE line_id = ?").run(lineId);
    db.prepare("DELETE FROM movies WHERE line_id = ?").run(lineId);
    db.prepare("DELETE FROM streams WHERE line_id = ?").run(lineId);
    db.prepare("DELETE FROM categories WHERE line_id = ?").run(lineId);

    const categories = new Map<string, string>(); // `${type}|${name}` -> id
    function categoryId(type: string, name: string): string {
      const key = `${type}|${name}`;
      const existing = categories.get(key);
      if (existing) return existing;
      const id = randomUUID();
      db.prepare("INSERT INTO categories (id, line_id, type, name, sort) VALUES (?, ?, ?, ?, ?)").run(
        id,
        lineId,
        type,
        name,
        categories.size
      );
      categories.set(key, id);
      return id;
    }

    let live = 0;
    let movies = 0;
    let vodSeq = VOD_BASE;

    for (const e of entries) {
      if (e.kind === "movie") {
        const cat = categoryId("vod", e.group);
        db.prepare(
          "INSERT INTO movies (id, line_id, category_id, name, url, icon, stream_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(randomUUID(), lineId, cat, e.name, e.url, e.logo || null, vodSeq++);
        movies++;
      } else {
        const cat = categoryId("live", e.group);
        db.prepare(
          "INSERT INTO streams (id, line_id, category_id, name, url, icon, epg_id, stream_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(randomUUID(), lineId, cat, e.name, e.url, e.logo || null, e.tvgId || null, live + 1);
        live++;
      }
    }

    db.exec("COMMIT");
    return { lineId, live, movies, categories: categories.size };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** Cancella il catalogo di una linea mantenendo la linea stessa. */
export function clearCatalog(db: Db, lineId: string): void {
  syncEntries(db, lineId, []);
}

export { VOD_BASE, SERIES_BASE };

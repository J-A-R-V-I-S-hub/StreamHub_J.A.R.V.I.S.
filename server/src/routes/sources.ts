import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db/index.ts";
import type { Config } from "../config.ts";
import { fail } from "../lib/errors.ts";
import { userFromRequest } from "../lib/http.ts";
import { parseM3u } from "../ingest/m3u.ts";
import { syncEntries } from "../ingest/sync.ts";
import { fetchXtreamEntries } from "../ingest/xtream.ts";
import { fetchArchiveEntries, ARCHIVE_COLLECTIONS, ARCHIVE_MIN_HEIGHT } from "../ingest/archive.ts";
import { enrichLine, type TmdbClient } from "../enrich/tmdb.ts";

type SourceRow = {
  id: string;
  line_id: string;
  type: string;
  url: string;
  username: string | null;
  password: string | null;
  last_sync: string | null;
  sync_error: string | null;
  created_at: string;
};

/** Collezioni disponibili per l'import pubblico (per il pannello). */
export { ARCHIVE_COLLECTIONS };

export function registerSourceRoutes(
  app: FastifyInstance,
  db: Db,
  _config: Config,
  tmdb: TmdbClient | null
): void {
  function requireUser(req: FastifyRequest, reply: FastifyReply) {
    const user = userFromRequest(db, req);
    if (!user) {
      fail(reply, 401, "unauthorized", "Token mancante o scaduto");
      return null;
    }
    return user;
  }

  function ownedLine(userId: string, lineId: string) {
    return db
      .prepare("SELECT id FROM lines WHERE id = ? AND user_id = ?")
      .get(lineId, userId) as { id: string } | undefined;
  }

  function ownedSource(userId: string, sourceId: string) {
    return db
      .prepare(
        "SELECT s.* FROM sources s JOIN lines l ON l.id = s.line_id WHERE s.id = ? AND l.user_id = ?"
      )
      .get(sourceId, userId) as SourceRow | undefined;
  }

  function publicSource(s: SourceRow) {
    return {
      id: s.id,
      line_id: s.line_id,
      type: s.type,
      url: s.url,
      last_sync: s.last_sync,
      sync_error: s.sync_error,
      created_at: s.created_at,
    };
  }

  app.get("/api/lines/:id/sources", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    if (!ownedLine(user.id, id)) return fail(reply, 404, "not_found", "linea non trovata");
    const rows = db
      .prepare("SELECT * FROM sources WHERE line_id = ? ORDER BY created_at")
      .all(id) as SourceRow[];
    return { sources: rows.map(publicSource) };
  });

  app.post("/api/lines/:id/sources", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    if (!ownedLine(user.id, id)) return fail(reply, 404, "not_found", "linea non trovata");

    const body = (req.body ?? {}) as { type?: string; url?: string; username?: string; password?: string };
    const type = (body.type ?? "m3u").trim();
    const url = (body.url ?? "").trim();
    if (!["m3u", "xtream", "local", "archive"].includes(type)) {
      return fail(reply, 400, "bad_request", "type deve essere m3u, xtream, local o archive");
    }
    if (type === "archive" && !ARCHIVE_COLLECTIONS[url]) {
      return fail(
        reply,
        400,
        "bad_request",
        `collezione sconosciuta. Disponibili: ${Object.keys(ARCHIVE_COLLECTIONS).join(", ")}`
      );
    }
    if (!url) return fail(reply, 400, "bad_request", "url obbligatorio");

    const row: SourceRow = {
      id: randomUUID(),
      line_id: id,
      type,
      url,
      username: body.username?.trim() || null,
      password: body.password || null,
      last_sync: null,
      sync_error: null,
      created_at: new Date().toISOString(),
    };
    db.prepare(
      "INSERT INTO sources (id, line_id, type, url, username, password, last_sync, sync_error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      row.id,
      row.line_id,
      row.type,
      row.url,
      row.username,
      row.password,
      row.last_sync,
      row.sync_error,
      row.created_at
    );
    return reply.code(201).send(publicSource(row));
  });

  app.delete("/api/sources/:id", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    if (!ownedSource(user.id, id)) return fail(reply, 404, "not_found", "sorgente non trovata");
    db.prepare("DELETE FROM sources WHERE id = ?").run(id);
    return reply.code(204).send();
  });

  /** Sincronizza: scarica, normalizza, scrive. In caso di errore lo salva, non lo nasconde. */
  app.post("/api/sources/:id/sync", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const source = ownedSource(user.id, id);
    if (!source) return fail(reply, 404, "not_found", "sorgente non trovata");

    try {
      let entries;
      if (source.type === "archive") {
        // Catalogo di pubblico dominio, importato in blocco nel database.
        const limit = Number(process.env.ARCHIVE_LIMIT ?? 60);
        entries = await fetchArchiveEntries({
          collection: source.url,
          limit,
          group: ARCHIVE_COLLECTIONS[source.url] ?? "Classici",
          minHeight: ARCHIVE_MIN_HEIGHT[source.url] ?? Number(process.env.ARCHIVE_MIN_HEIGHT ?? 0),
        });
      } else if (source.type === "xtream") {
        if (!source.username || !source.password) {
          throw new Error("sorgente xtream senza username/password");
        }
        entries = await fetchXtreamEntries({
          url: source.url,
          username: source.username,
          password: source.password,
        });
      } else {
        const res = await fetch(source.url, { signal: AbortSignal.timeout(60000) });
        if (!res.ok) throw new Error(`HTTP ${res.status} scaricando la playlist`);
        entries = parseM3u(await res.text());
      }

      if (entries.length === 0) throw new Error("playlist vuota o non riconosciuta");

      const result = syncEntries(db, source.line_id, entries);
      // Arricchimento: se non c'è la chiave TMDb, enrichLine non fa nulla.
      const enrichment = await enrichLine(db, source.line_id, tmdb);
      db.prepare("UPDATE sources SET last_sync = ?, sync_error = NULL WHERE id = ?").run(
        new Date().toISOString(),
        source.id
      );
      return { ok: true, ...result, enrichment };
    } catch (err) {
      const message = (err as Error).message;
      db.prepare("UPDATE sources SET sync_error = ? WHERE id = ?").run(message, source.id);
      return fail(reply, 502, "sync_failed", message);
    }
  });

  app.get("/api/sources/:id/status", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const source = ownedSource(user.id, id);
    if (!source) return fail(reply, 404, "not_found", "sorgente non trovata");
    return publicSource(source);
  });
}

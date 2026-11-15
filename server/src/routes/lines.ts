import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db/index.ts";
import type { Config } from "../config.ts";
import { fail } from "../lib/errors.ts";
import { userFromRequest } from "../lib/http.ts";
import type { SessionUser } from "../lib/session.ts";
import { isPlanActive, maxLinesFor } from "../lib/plan.ts";

type LineRow = {
  id: string;
  user_id: string;
  name: string;
  xtream_username: string;
  xtream_password: string;
  status: string;
  max_connections: number;
  expires_at: string | null;
  created_at: string;
};

function newXtreamUser(): string {
  return "u" + randomBytes(4).toString("hex");
}

function newXtreamPass(): string {
  return randomBytes(9).toString("base64url");
}

/** Le linee si vedono sempre e solo per il proprio utente. */
export function registerLineRoutes(app: FastifyInstance, db: Db, config: Config): void {
  function requireUser(req: FastifyRequest, reply: FastifyReply): SessionUser | null {
    const user = userFromRequest(db, req);
    if (!user) {
      fail(reply, 401, "unauthorized", "Token mancante o scaduto");
      return null;
    }
    if (!isPlanActive(user)) {
      fail(reply, 403, "plan_expired", "Il tuo piano è scaduto: rinnova per continuare.");
      return null;
    }
    return user;
  }

  function findOwned(userId: string, id: string): LineRow | undefined {
    return db
      .prepare("SELECT * FROM lines WHERE id = ? AND user_id = ?")
      .get(id, userId) as LineRow | undefined;
  }

  function publicLine(l: LineRow) {
    return {
      id: l.id,
      name: l.name,
      status: l.status,
      max_connections: l.max_connections,
      expires_at: l.expires_at,
      created_at: l.created_at,
      xtream_username: l.xtream_username,
    };
  }

  app.get("/api/lines", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const rows = db
      .prepare("SELECT * FROM lines WHERE user_id = ? ORDER BY created_at")
      .all(user.id) as LineRow[];
    return { lines: rows.map(publicLine) };
  });

  app.post("/api/lines", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const body = (req.body ?? {}) as { name?: string };
    const name = (body.name ?? "").trim();
    if (!name) return fail(reply, 400, "bad_request", "il nome della linea è obbligatorio");

    const count = (
      db.prepare("SELECT COUNT(*) AS n FROM lines WHERE user_id = ?").get(user.id) as { n: number }
    ).n;
    const limit = maxLinesFor(user.plan);
    if (count >= limit) {
      return fail(
        reply,
        403,
        "line_limit",
        `Il piano ${user.plan} consente ${limit} linea/e. Rimuovine una o passa a un piano superiore.`
      );
    }

    const line: LineRow = {
      id: randomUUID(),
      user_id: user.id,
      name,
      xtream_username: newXtreamUser(),
      xtream_password: newXtreamPass(),
      status: "active",
      max_connections: 1,
      expires_at: null,
      created_at: new Date().toISOString(),
    };

    db.prepare(
      `INSERT INTO lines (id, user_id, name, xtream_username, xtream_password, status, max_connections, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      line.id,
      line.user_id,
      line.name,
      line.xtream_username,
      line.xtream_password,
      line.status,
      line.max_connections,
      line.expires_at,
      line.created_at
    );

    return reply.code(201).send(publicLine(line));
  });

  app.get("/api/lines/:id", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const line = findOwned(user.id, id);
    if (!line) return fail(reply, 404, "not_found", "linea non trovata");
    return publicLine(line);
  });

  app.put("/api/lines/:id", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const line = findOwned(user.id, id);
    if (!line) return fail(reply, 404, "not_found", "linea non trovata");

    const body = (req.body ?? {}) as {
      name?: string;
      status?: string;
      max_connections?: number;
      expires_at?: string | null;
    };

    const next: LineRow = {
      ...line,
      name: body.name?.trim() || line.name,
      status: body.status ?? line.status,
      max_connections:
        typeof body.max_connections === "number" ? body.max_connections : line.max_connections,
      expires_at: body.expires_at === undefined ? line.expires_at : body.expires_at,
    };

    if (!["active", "expired", "disabled"].includes(next.status)) {
      return fail(reply, 400, "bad_request", "status deve essere active, expired o disabled");
    }

    db.prepare(
      "UPDATE lines SET name = ?, status = ?, max_connections = ?, expires_at = ? WHERE id = ?"
    ).run(next.name, next.status, next.max_connections, next.expires_at, id);

    return publicLine(next);
  });

  app.delete("/api/lines/:id", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const line = findOwned(user.id, id);
    if (!line) return fail(reply, 404, "not_found", "linea non trovata");
    db.prepare("DELETE FROM lines WHERE id = ?").run(id);
    return reply.code(204).send();
  });

  /** I 4 campi che vanno digitati in IBO Player. */
  app.get("/api/lines/:id/connect", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const line = findOwned(user.id, id);
    if (!line) return fail(reply, 404, "not_found", "linea non trovata");

    return {
      playlist_name: line.name,
      playlist_url: config.publicUrl,
      username: line.xtream_username,
      password: line.xtream_password,
    };
  });
}

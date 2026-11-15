import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db/index.ts";
import { fail } from "../lib/errors.ts";
import { userFromRequest } from "../lib/http.ts";

/**
 * Catalogo normalizzato per il pannello: poster, trama, categorie.
 * E' la vista "bella" dei dati che il player vede grezzi.
 */
export function registerCatalogRoutes(app: FastifyInstance, db: Db): void {
  function requireUser(req: FastifyRequest, reply: FastifyReply) {
    const user = userFromRequest(db, req);
    if (!user) {
      fail(reply, 401, "unauthorized", "Token mancante o scaduto");
      return null;
    }
    return user;
  }

  app.get("/api/lines/:id/catalog", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };

    const line = db
      .prepare("SELECT id, name FROM lines WHERE id = ? AND user_id = ?")
      .get(id, user.id) as { id: string; name: string } | undefined;
    if (!line) return fail(reply, 404, "not_found", "linea non trovata");

    const categories = db
      .prepare("SELECT id, type, name FROM categories WHERE line_id = ? ORDER BY type, sort, name")
      .all(id) as Array<{ id: string; type: string; name: string }>;

    const movies = db
      .prepare(
        "SELECT stream_id, name, icon, plot, year, rating, category_id FROM movies WHERE line_id = ? ORDER BY name LIMIT 500"
      )
      .all(id);

    const live = db
      .prepare("SELECT stream_id, name, icon, category_id FROM streams WHERE line_id = ? ORDER BY stream_id LIMIT 500")
      .all(id);

    return {
      line: { id: line.id, name: line.name },
      categories,
      movies,
      live,
      counts: { categories: categories.length, movies: movies.length, live: live.length },
    };
  });
}

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db/index.ts";
import { fail } from "../lib/errors.ts";
import { userFromRequest } from "../lib/http.ts";
import { daysLeft } from "../lib/plan.ts";

export function registerAdminRoutes(app: FastifyInstance, db: Db): void {
  function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
    const user = userFromRequest(db, req);
    if (!user) {
      fail(reply, 401, "unauthorized", "Token mancante o scaduto");
      return null;
    }
    if (user.role !== "admin") {
      fail(reply, 403, "forbidden", "serve un account amministratore");
      return null;
    }
    return user;
  }

  app.get("/api/admin/users", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const rows = db
      .prepare(
        "SELECT id, email, role, plan, plan_expires_at, created_at FROM users ORDER BY created_at"
      )
      .all() as Array<{
      id: string;
      email: string;
      role: string;
      plan: string;
      plan_expires_at: string | null;
      created_at: string;
    }>;

    return {
      users: rows.map((u) => ({
        ...u,
        days_left: daysLeft({ plan_expires_at: u.plan_expires_at }),
        lines: (
          db.prepare("SELECT COUNT(*) AS n FROM lines WHERE user_id = ?").get(u.id) as { n: number }
        ).n,
      })),
    };
  });

  /** Imposta piano e scadenza. `days: 0` = nessuna scadenza (lifetime). */
  app.put("/api/admin/users/:id/plan", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { plan?: string; days?: number };

    const exists = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
    if (!exists) return fail(reply, 404, "not_found", "utente non trovato");

    const plan = body.plan ?? "trial";
    if (!["trial", "base", "pro", "lifetime"].includes(plan)) {
      return fail(reply, 400, "bad_request", "piano non valido");
    }

    const days = typeof body.days === "number" ? body.days : 30;
    const expires =
      plan === "lifetime" || days === 0
        ? null
        : new Date(Date.now() + days * 86_400_000).toISOString();

    db.prepare("UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?").run(plan, expires, id);
    return { ok: true, plan, plan_expires_at: expires };
  });
}

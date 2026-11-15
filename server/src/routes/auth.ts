import type { FastifyInstance } from "fastify";
import type { Db } from "../db/index.ts";
import type { Config } from "../config.ts";
import { verifyPassword } from "../lib/password.ts";
import { createSession, revokeSession } from "../lib/session.ts";
import { fail } from "../lib/errors.ts";
import { tokenFromRequest, userFromRequest } from "../lib/http.ts";
import { daysLeft, isPlanActive } from "../lib/plan.ts";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../lib/password.ts";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  plan: string;
  plan_expires_at: string | null;
};

export function registerAuthRoutes(app: FastifyInstance, db: Db, config: Config): void {
  const secure = config.publicUrl.startsWith("https://");

  function cookieFor(token: string, maxAge: number): string {
    const parts = [
      `sid=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAge}`,
    ];
    if (secure) parts.push("Secure");
    return parts.join("; ");
  }

  app.post("/api/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string; password?: string };
    const email = (body.email ?? "").trim();
    const password = body.password ?? "";
    if (!email || !password) {
      return fail(reply, 400, "bad_request", "email e password sono obbligatorie");
    }

    const user = db
      .prepare("SELECT * FROM users WHERE lower(email) = lower(?)")
      .get(email) as UserRow | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return fail(reply, 401, "invalid_credentials", "Email o password non corretti");
    }

    const session = createSession(db, user.id, config.sessionTtlDays, req.headers["user-agent"]);
    reply.header("set-cookie", cookieFor(session.token, config.sessionTtlDays * 86400));

    return {
      token: session.token,
      expires_at: session.expiresAt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
        plan_expires_at: user.plan_expires_at,
      },
    };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = tokenFromRequest(req);
    if (token) revokeSession(db, token);
    reply.header("set-cookie", "sid=; Path=/; HttpOnly; Max-Age=0");
    return { ok: true };
  });

  app.get("/api/me", async (req, reply) => {
    const user = userFromRequest(db, req);
    if (!user) return fail(reply, 401, "unauthorized", "Token mancante o scaduto");
    return {
      user,
      active: isPlanActive(user),
      days_left: daysLeft(user),
    };
  });

  /** Registrazione self-service: disattivata salvo ALLOW_REGISTRATION=1. */
  app.post("/api/auth/register", async (req, reply) => {
    if ((process.env.ALLOW_REGISTRATION ?? "0") !== "1") {
      return fail(reply, 403, "registration_disabled", "Le iscrizioni sono chiuse: chiedi un invito.");
    }
    const body = (req.body ?? {}) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email.includes("@")) return fail(reply, 400, "bad_request", "email non valida");
    if (password.length < 8) {
      return fail(reply, 400, "bad_request", "la password deve avere almeno 8 caratteri");
    }
    const taken = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email);
    if (taken) return fail(reply, 409, "email_taken", "esiste già un account con questa email");

    const trialDays = Number(process.env.TRIAL_DAYS ?? 14);
    const id = randomUUID();
    db.prepare(
      "INSERT INTO users (id, email, password_hash, role, plan, plan_expires_at, created_at) VALUES (?, ?, ?, 'user', 'trial', ?, ?)"
    ).run(
      id,
      email,
      hashPassword(password),
      new Date(Date.now() + trialDays * 86_400_000).toISOString(),
      new Date().toISOString()
    );

    const session = createSession(db, id, config.sessionTtlDays, req.headers["user-agent"]);
    reply.header("set-cookie", cookieFor(session.token, config.sessionTtlDays * 86400));
    return reply.code(201).send({
      token: session.token,
      expires_at: session.expiresAt,
      user: { id, email, role: "user", plan: "trial", plan_expires_at: null },
    });
  });
}

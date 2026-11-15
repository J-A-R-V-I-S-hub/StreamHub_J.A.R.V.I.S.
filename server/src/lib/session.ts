import { createHash, randomBytes } from "node:crypto";
import type { Db } from "../db/index.ts";

/** In tabella non salviamo il token, ma il suo hash: un dump non basta a rubare sessioni. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type Session = { token: string; expiresAt: string };

export function createSession(
  db: Db,
  userId: string,
  ttlDays: number,
  userAgent?: string
): Session {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 86_400_000).toISOString();
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)"
  ).run(hashToken(token), userId, now.toISOString(), expiresAt, userAgent ?? null);
  return { token, expiresAt };
}

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  plan: string;
  plan_expires_at: string | null;
};

export function userFromToken(db: Db, token: string): SessionUser | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.role, u.plan, u.plan_expires_at, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`
    )
    .get(hashToken(token)) as (SessionUser & { expires_at: string }) | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    revokeSession(db, token);
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    plan: row.plan,
    plan_expires_at: row.plan_expires_at,
  };
}

export function revokeSession(db: Db, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

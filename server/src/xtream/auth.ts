import type { Db } from "../db/index.ts";

export type LineRow = {
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

/** Autenticazione Xtream: username/password della linea, non dell'utente. */
export function findLine(db: Db, username: string, password: string): LineRow | null {
  const u = (username ?? "").trim();
  const p = password ?? "";
  if (!u || !p) return null;
  const line = db
    .prepare("SELECT * FROM lines WHERE xtream_username = ?")
    .get(u) as LineRow | undefined;
  if (!line) return null;
  if (line.xtream_password !== p) return null;
  if (line.status !== "active") return null;
  if (line.expires_at && new Date(line.expires_at).getTime() < Date.now()) return null;
  return line;
}

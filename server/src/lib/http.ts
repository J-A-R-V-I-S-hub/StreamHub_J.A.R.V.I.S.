import type { FastifyRequest } from "fastify";
import type { Db } from "../db/index.ts";
import { userFromToken, type SessionUser } from "./session.ts";

/** Token da Authorization: Bearer oppure dal cookie sid. */
export function tokenFromRequest(req: FastifyRequest): string {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookie = req.headers.cookie ?? "";
  for (const part of cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "sid") return rest.join("=");
  }
  return "";
}

export function userFromRequest(db: Db, req: FastifyRequest): SessionUser | null {
  return userFromToken(db, tokenFromRequest(req));
}

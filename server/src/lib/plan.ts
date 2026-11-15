import type { SessionUser } from "./session.ts";

export type Plan = "trial" | "base" | "pro" | "lifetime";

/** Quante linee può avere un piano. */
export const MAX_LINES: Record<Plan, number> = {
  trial: 1,
  base: 2,
  pro: 5,
  lifetime: 100,
};

export function maxLinesFor(plan: string): number {
  return MAX_LINES[(plan as Plan) in MAX_LINES ? (plan as Plan) : "trial"];
}

/** Il piano è attivo se non scade, oppure se la scadenza è nel futuro. */
export function isPlanActive(user: Pick<SessionUser, "plan" | "plan_expires_at">): boolean {
  if (user.plan === "lifetime") return true;
  if (!user.plan_expires_at) return true; // nessuna scadenza impostata = attivo
  return new Date(user.plan_expires_at).getTime() > Date.now();
}

export function daysLeft(user: Pick<SessionUser, "plan_expires_at">): number | null {
  if (!user.plan_expires_at) return null;
  const ms = new Date(user.plan_expires_at).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

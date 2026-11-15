import type { LineRow } from "./auth.ts";

export const now = (): number => Math.floor(Date.now() / 1000);

/** Gli URL devono essere assoluti: i client non accettano path relativi. */
export function absUrl(value: string | null | undefined, base: string): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v) || v.startsWith("data:")) return v;
  return base + (v.startsWith("/") ? v : "/" + v);
}

/**
 * Blocco user_info. I formati di output DEVONO includere mp4: senza,
 * alcuni player scartano tutto il catalogo VOD e mostrano la sezione vuota.
 */
export function userInfo(line: LineRow, base: string) {
  return {
    username: line.xtream_username,
    password: line.xtream_password,
    message: "Benvenuto",
    auth: 1,
    status: "Active",
    exp_date: line.expires_at
      ? String(Math.floor(new Date(line.expires_at).getTime() / 1000))
      : null,
    is_trial: "0",
    active_cons: "1",
    created_at: String(Math.floor(new Date(line.created_at).getTime() / 1000)),
    max_connections: String(line.max_connections),
    allowed_output_formats: ["ts", "m3u8", "mp4", "mkv"],
    logo: absUrl("/logo.svg", base),
  };
}

export function serverInfo(base: string) {
  let url = "localhost";
  let port = "8080";
  let protocol = "http";
  try {
    const parsed = new URL(base);
    url = parsed.hostname;
    port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    protocol = parsed.protocol.replace(":", "");
  } catch {
    /* base non valida: restano i valori di default */
  }
  return {
    url,
    port,
    https_port: "443",
    server_protocol: protocol,
    rtmp_port: "1935",
    timezone: "Europe/Rome",
    timestamp_now: now(),
    time_now: new Date().toISOString().replace("T", " ").slice(0, 19),
  };
}

/** Risposta di credenziali sbagliate: stessa forma per tutti i client. */
export function unauthorized() {
  return {
    user_info: {
      username: "",
      password: "",
      message: "Credenziali non valide",
      auth: 0,
      status: "Disabled",
    },
  };
}

export type CategoryRow = { id: string; line_id: string; type: string; name: string; sort: number };

export function category(c: CategoryRow) {
  return {
    category_id: c.id,
    category_name: c.name,
    parent_id: 0,
  };
}

/**
 * L'estensione che il player userà per chiedere il file.
 * DEVE combaciare con il file vero: se diciamo mp4 e la sorgente è .avi,
 * il player prova a decodificare un container che non conosce e va in loop.
 */
export function extFromUrl(url: string): string {
  const clean = (url ?? "").split("?")[0].toLowerCase();
  const m = clean.match(/\.([a-z0-9]{2,5})$/);
  const ext = m ? m[1] : "";
  return ["mp4", "mkv", "avi", "mov", "m4v", "webm", "ts", "m3u8"].includes(ext) ? ext : "mp4";
}

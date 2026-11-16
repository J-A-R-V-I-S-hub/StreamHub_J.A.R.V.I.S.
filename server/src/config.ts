/** Configurazione: tutto dall'ambiente. Se manca qualcosa, non si parte. */

export type Config = {
  nodeEnv: string;
  port: number;
  host: string;
  serverUrl: string;
  databasePath: string;
  sessionTtlDays: number;
  adminEmail: string;
  adminPassword: string;
  logLevel: string;
  tmdbApiKey: string;
  tmdbLanguage: string;
  tmdbCachePath: string;
  dataDir: string;
};

function required(name: string, value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v) {
    console.error(`[config] manca ${name}. Copia .env.example in .env e valorizzala.`);
    process.exit(1);
  }
  return v;
}

function intOr(name: string, value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`[config] ${name} deve essere un intero positivo, ricevuto: ${value}`);
    process.exit(1);
  }
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    nodeEnv: env.NODE_ENV ?? "development",
    port: intOr("PORT", env.PORT, 8080),
    host: env.HOST ?? "0.0.0.0",
    serverUrl: required("SERVER_URL", env.SERVER_URL).replace(/\/+$/, ""),
    databasePath: required("DATABASE_PATH", env.DATABASE_PATH),
    sessionTtlDays: intOr("SESSION_TTL_DAYS", env.SESSION_TTL_DAYS, 30),
    adminEmail: env.ADMIN_EMAIL?.trim() || "admin@local.it",
    adminPassword: env.ADMIN_PASSWORD ?? "",
    logLevel: env.LOG_LEVEL ?? "info",
    tmdbApiKey: (env.TMDB_API_KEY ?? "").trim(),
    tmdbLanguage: env.TMDB_LANGUAGE || "it-IT",
    tmdbCachePath: env.TMDB_CACHE_PATH || "data/tmdb-cache.json",
    dataDir: env.DATA_DIR || "data",
  };
}

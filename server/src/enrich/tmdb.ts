import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Db } from "../db/index.ts";

/** Quello che ci serve da TMDb, niente di più. */
export type TmdbMatch = {
  tmdb_id: number;
  poster: string;
  plot: string;
  year: number | null;
  rating: number | null;
};

export type TmdbClient = {
  searchMovie(title: string, year: number | null): Promise<TmdbMatch | null>;
};

/** Minuscole, senza accenti, senza articoli e punteggiatura: per confrontare i titoli. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(the|il|lo|la|i|gli|le|un|uno|una|a|an)\b/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type CacheFile = Record<string, TmdbMatch | null>;

/**
 * Client reale. Se manca la chiave API restituisce sempre null:
 * il prodotto continua a funzionare, semplicemente senza poster.
 */
export function createTmdbClient(options: {
  apiKey: string;
  language?: string;
  cachePath?: string;
  fetchImpl?: typeof fetch;
}): TmdbClient {
  const { apiKey, language = "it-IT", cachePath, fetchImpl = fetch } = options;

  let cache: CacheFile = {};
  if (cachePath && existsSync(cachePath)) {
    try {
      cache = JSON.parse(readFileSync(cachePath, "utf8")) as CacheFile;
    } catch {
      cache = {};
    }
  }

  function persist(): void {
    if (!cachePath) return;
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(cache), "utf8");
  }

  return {
    async searchMovie(title: string, year: number | null): Promise<TmdbMatch | null> {
      if (!apiKey) return null;
      const key = `${normalizeTitle(title)}|${year ?? ""}`;
      if (key in cache) return cache[key];

      const url = new URL("https://api.themoviedb.org/3/search/movie");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("language", language);
      url.searchParams.set("query", title);
      if (year) url.searchParams.set("year", String(year));

      let result: TmdbMatch | null = null;
      try {
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
        // backoff semplice: un 429 non deve far fallire tutto il sync
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (res.ok) {
          const body = (await res.json()) as {
            results?: Array<{
              id: number;
              poster_path?: string | null;
              overview?: string;
              release_date?: string;
              vote_average?: number;
            }>;
          };
          const first = body.results?.[0];
          if (first) {
            result = {
              tmdb_id: first.id,
              poster: first.poster_path ? `https://image.tmdb.org/t/p/w500${first.poster_path}` : "",
              plot: first.overview ?? "",
              year: first.release_date ? Number(first.release_date.slice(0, 4)) || null : null,
              rating: typeof first.vote_average === "number" ? first.vote_average : null,
            };
          }
        }
      } catch {
        result = null;
      }

      cache[key] = result;
      persist();
      return result;
    },
  };
}

export type EnrichReport = { examined: number; matched: number; skipped: boolean };

/**
 * Arricchisce i film di una linea che non hanno ancora tmdb_id.
 * Senza client (cioè senza chiave) non fa nulla e lo dice.
 */
export async function enrichLine(
  db: Db,
  lineId: string,
  client: TmdbClient | null
): Promise<EnrichReport> {
  if (!client) return { examined: 0, matched: 0, skipped: true };

  const rows = db
    .prepare("SELECT id, name, year, icon FROM movies WHERE line_id = ? AND tmdb_id IS NULL")
    .all(lineId) as Array<{ id: string; name: string; year: number | null; icon: string | null }>;

  let matched = 0;
  for (const row of rows) {
    const match = await client.searchMovie(row.name, row.year ?? null);
    if (!match) continue;
    db.prepare(
      "UPDATE movies SET tmdb_id = ?, plot = COALESCE(NULLIF(?, ''), plot), icon = COALESCE(NULLIF(?, ''), icon), year = COALESCE(?, year), rating = COALESCE(?, rating) WHERE id = ?"
    ).run(match.tmdb_id, match.plot, match.poster, match.year, match.rating, row.id);
    matched++;
  }
  return { examined: rows.length, matched, skipped: false };
}

/** Il client da usare in produzione: legge la chiave dall'ambiente. */
export function tmdbFromEnv(env: NodeJS.ProcessEnv, cachePath?: string): TmdbClient | null {
  const apiKey = (env.TMDB_API_KEY ?? "").trim();
  if (!apiKey) return null;
  return createTmdbClient({
    apiKey,
    language: env.TMDB_LANGUAGE || "it-IT",
    cachePath,
  });
}

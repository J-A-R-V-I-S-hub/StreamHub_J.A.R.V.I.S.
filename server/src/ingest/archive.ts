import type { M3uEntry } from "./m3u.ts";

/**
 * Import da Internet Archive: solo opere di pubblico dominio, con file MP4.
 *
 * Due chiamate:
 *   1. advancedsearch  -> elenco (titolo, anno, identifier)
 *   2. metadata/{id}/files -> quale file mp4 usare
 *
 * La copertina arriva da services/img/{id}: nessuna chiave API, nessun costo.
 */

export type ArchiveOptions = {
  collection: string;
  limit: number;
  group?: string;
  /** Altezza minima in pixel: 720 = solo HD. 0 = prendi il migliore disponibile. */
  minHeight?: number;
  /** Titoli da scartare: anteprime, trailer, dietro le quinte, filmati stock. */
  exclude?: RegExp;
  fetchImpl?: typeof fetch;
};

type SearchDoc = {
  identifier: string;
  title?: string;
  year?: string | number;
  description?: string | string[];
};

type IaFile = {
  name: string;
  format?: string;
  size?: string;
  width?: string;
  height?: string;
};

const SEARCH = "https://archive.org/advancedsearch.php";
const META = "https://archive.org/metadata";
const IMG = "https://archive.org/services/img";

/**
 * Sceglie il file MP4 con la risoluzione più alta.
 *
 * I file di archive.org dichiarano width/height: senza questo si finisce
 * sempre sul derivato da 360p. Con `minHeight` si può pretendere almeno
 * 720p e scartare l'item se non lo raggiunge.
 */
function pickMp4(files: IaFile[], minHeight = 0): string | null {
  const mp4s = files.filter((f) => f.name.toLowerCase().endsWith(".mp4"));
  if (mp4s.length === 0) return null;

  const heightOf = (f: IaFile) => Number(f.height) || 0;

  const candidati = mp4s
    .map((f) => ({ file: f, h: heightOf(f) }))
    .sort((a, b) => b.h - a.h);

  const migliore = candidati[0];
  if (minHeight > 0 && migliore.h > 0 && migliore.h < minHeight) return null;

  return migliore.file.name;
}

function cleanText(value: string | string[] | undefined): string {
  if (!value) return "";
  const text = Array.isArray(value) ? value.join(" ") : value;
  return text.replace(/\s+/g, " ").trim();
}

async function getJson(url: string, fetchImpl: typeof fetch, timeoutMs = 20000): Promise<unknown> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Internet Archive HTTP ${res.status}`);
  return res.json();
}

/** Esegue `worker` su tutti gli elementi, con al massimo `limit` in parallelo. */
async function pool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return out;
}

export async function fetchArchiveEntries(opts: ArchiveOptions): Promise<M3uEntry[]> {
  const { collection, limit, group = "Classici", fetchImpl = fetch } = opts;
  const minHeight = Number(opts.minHeight ?? process.env.ARCHIVE_MIN_HEIGHT ?? 0);
  const exclude =
    opts.exclude ??
    /(preview|trailer|teaser|making of|behind the scenes|blender radio|text effects|stock footage|sample)/i;

  // `collection` può essere una chiave nota (con la sua query) o un nome di collezione IA.
  const q = ARCHIVE_QUERIES[collection] ?? `collection:(${collection})`;
  const search = new URL(SEARCH);
  search.searchParams.set("q", `${q} AND mediatype:movies AND format:MPEG4`);
  search.searchParams.set("fl[]", "identifier");
  search.searchParams.append("fl[]", "title");
  search.searchParams.append("fl[]", "year");
  search.searchParams.append("fl[]", "description");
  search.searchParams.set("sort[]", "downloads desc");
  search.searchParams.set("rows", String(limit));
  search.searchParams.set("output", "json");

  const data = (await getJson(search.toString(), fetchImpl)) as {
    response?: { docs?: SearchDoc[] };
  };
  const docs = (data.response?.docs ?? [])
    .filter((d) => d.identifier)
    .filter((d) => !exclude.test(cleanText(d.title)));

  const entries = await pool(docs, 5, async (doc): Promise<M3uEntry | null> => {
    try {
      const meta = (await getJson(`${META}/${doc.identifier}/files`, fetchImpl)) as {
        result?: IaFile[];
      };
      const file = pickMp4(meta.result ?? [], minHeight);
      if (!file) return null;

      const year = doc.year ? Number(String(doc.year).slice(0, 4)) || null : null;
      return {
        name: cleanText(doc.title) || doc.identifier,
        url: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(file)}`,
        group,
        logo: `${IMG}/${doc.identifier}`,
        tvgId: "",
        kind: "movie",
        year,
        plot: cleanText(doc.description).slice(0, 800),
      } as M3uEntry;
    } catch {
      return null; // un item rotto non deve fermare l'import
    }
  });

  return dedupe(entries.filter((e): e is M3uEntry => e !== null));
}

/**
 * Lo stesso film è spesso caricato più volte (4K, 1080p, "Blender Open Movie").
 * Tiene il primo — l'elenco è già ordinato per download — e scarta i doppioni.
 */
function dedupe(entries: M3uEntry[]): M3uEntry[] {
  const visti = new Set<string>();
  const out: M3uEntry[] = [];
  for (const e of entries) {
    const normalizzato = e.name
      .toLowerCase()
      .replace(/\b(4k|uhd|1080p|720p|60fps|hd|open movie|blender\w*)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 4)
      .join(" ");
    // se il titolo è fatto solo di sigle (es. "HD"), uso il nome grezzo
    const chiave = normalizzato || e.name.toLowerCase().trim();
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    out.push(e);
  }
  return out;
}

/**
 * Collezioni disponibili. La chiave è ciò che si salva nella sorgente,
 * il valore è l'etichetta che vede l'utente.
 */
export const ARCHIVE_COLLECTIONS: Record<string, string> = {
  open_hd: "Film open in HD",
  feature_films: "Film di pubblico dominio",
  silent_films: "Film muti",
  more_animation: "Animazione",
  classic_tv: "Telefilm classici",
};

/**
 * Query vera per ogni chiave.
 * `open_hd` non è una collezione: è una ricerca sui progetti open moderni
 * (Blender Foundation e assimilati), dove l'HD esiste davvero.
 */
export const ARCHIVE_QUERIES: Record<string, string> = {
  // Solo progetti di film open: senza questo filtro arrivano migliaia di
  // filmati stock (fumo, bokeh, time lapse) che non sono film.
  open_hd: '(subject:"Blender Foundation" OR subject:"open movie")',
};

/** Collezioni che pretendiamo almeno a 720p. */
export const ARCHIVE_MIN_HEIGHT: Record<string, number> = {
  open_hd: 720,
};

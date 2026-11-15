import type { M3uEntry } from "./m3u.ts";

type Upstream = { url: string; username: string; password: string };

function api(u: Upstream, action: string): string {
  const base = u.url.replace(/\/+$/, "");
  const q = new URLSearchParams({ username: u.username, password: u.password, action });
  return `${base}/player_api.php?${q.toString()}`;
}

async function getJson(url: string, timeoutMs = 30000): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`upstream HTTP ${res.status}`);
  return res.json();
}

/**
 * Importa da un altro pannello Xtream usando player_api.php.
 * Le serie sono un caso a parte (una chiamata per serie): restano da fare.
 */
export async function fetchXtreamEntries(u: Upstream): Promise<M3uEntry[]> {
  const entries: M3uEntry[] = [];

  const liveCats = (await getJson(api(u, "get_live_categories"))) as Array<{
    category_id: string;
    category_name: string;
  }>;
  const liveNames = new Map(liveCats.map((c) => [String(c.category_id), c.category_name]));

  const live = (await getJson(api(u, "get_live_streams"))) as Array<{
    stream_id: number;
    name: string;
    stream_icon?: string;
    epg_channel_id?: string;
    category_id?: string;
  }>;
  for (const s of live) {
    entries.push({
      name: s.name,
      url: `${u.url.replace(/\/+$/, "")}/live/${u.username}/${u.password}/${s.stream_id}.ts`,
      group: liveNames.get(String(s.category_id)) ?? "Live",
      logo: s.stream_icon ?? "",
      tvgId: s.epg_channel_id ?? "",
      kind: "live",
    });
  }

  const vodCats = (await getJson(api(u, "get_vod_categories"))) as Array<{
    category_id: string;
    category_name: string;
  }>;
  const vodNames = new Map(vodCats.map((c) => [String(c.category_id), c.category_name]));

  const vod = (await getJson(api(u, "get_vod_streams"))) as Array<{
    stream_id: number;
    name: string;
    stream_icon?: string;
    category_id?: string;
    container_extension?: string;
  }>;
  for (const m of vod) {
    const ext = m.container_extension || "mp4";
    entries.push({
      name: m.name,
      url: `${u.url.replace(/\/+$/, "")}/movie/${u.username}/${u.password}/${m.stream_id}.${ext}`,
      group: vodNames.get(String(m.category_id)) ?? "Film",
      logo: m.stream_icon ?? "",
      tvgId: "",
      kind: "movie",
    });
  }

  return entries;
}

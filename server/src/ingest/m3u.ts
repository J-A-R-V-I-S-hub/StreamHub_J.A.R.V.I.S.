/** Parser M3U tollerante: attributi, gruppi, opzioni VLC, commenti. */

export type M3uEntry = {
  name: string;
  url: string;
  group: string;
  logo: string;
  tvgId: string;
  kind: "live" | "movie";
};

const ATTR = /([a-zA-Z0-9-_]+)="([^"]*)"/g;

function parseAttrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR.lastIndex = 0;
  while ((m = ATTR.exec(line)) !== null) out[m[1].toLowerCase()] = m[2];
  return out;
}

/** L'estensione dice il tipo; senza estensione si assume live. */
function kindOf(url: string): "live" | "movie" {
  const path = url.split("?")[0].toLowerCase();
  if (/\.(mp4|mkv|avi|mov|m4v|webm)$/.test(path)) return "movie";
  return "live";
}

export function parseM3u(text: string): M3uEntry[] {
  const lines = text.split(/\r?\n/);
  const entries: M3uEntry[] = [];
  let pending: { name: string; attrs: Record<string, string>; group: string } | null = null;
  // #EXTGRP può stare PRIMA di #EXTINF (applica al prossimo) o subito dopo.
  let groupHint = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const comma = line.indexOf(",");
      const head = comma === -1 ? line : line.slice(0, comma);
      const name = comma === -1 ? "" : line.slice(comma + 1).trim();
      const attrs = parseAttrs(head);
      pending = { name, attrs, group: attrs["group-title"] || groupHint };
      groupHint = "";
      continue;
    }

    if (line.startsWith("#EXTGRP:")) {
      const value = line.slice(8).trim();
      if (pending) pending.group = value || pending.group;
      else groupHint = value;
      continue;
    }

    // #EXTVLCOPT, #EXTM3U e altri commenti: si ignorano
    if (line.startsWith("#")) continue;

    if (pending) {
      entries.push({
        name: pending.name || pending.attrs["tvg-name"] || "Senza nome",
        url: line,
        group: pending.group || "Altro",
        logo: pending.attrs["tvg-logo"] ?? "",
        tvgId: pending.attrs["tvg-id"] ?? "",
        kind: kindOf(line),
      });
      pending = null;
    }
  }
  return entries;
}

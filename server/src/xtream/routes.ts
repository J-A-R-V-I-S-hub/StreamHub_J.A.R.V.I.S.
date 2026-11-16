import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db/index.ts";
import type { Config } from "../config.ts";
import { findLine, type LineRow } from "./auth.ts";
import { absUrl, category, extFromUrl, now, serverInfo, unauthorized, userInfo } from "./shapes.ts";

type Params = Record<string, string>;

/** Query + body form-urlencoded, come fa un player. */
function readParams(req: FastifyRequest): Params {
  const params: Params = {};
  const add = (source: unknown) => {
    if (!source || typeof source !== "object") return;
    for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
      params[k] = String(v ?? "");
    }
  };
  add(req.query);
  add(req.body);
  return params;
}

function lineFrom(req: FastifyRequest, db: Db): LineRow | null {
  const p = readParams(req);
  return findLine(db, p.username, p.password);
}

export function registerXtreamRoutes(app: FastifyInstance, db: Db, config: Config): void {
  const base = config.serverUrl;

  /** /player_api.php — un solo endpoint, tante action. */
  app.all("/player_api.php", async (req, reply) => {
    const params = readParams(req);
    const line = findLine(db, params.username, params.password);
    if (!line) return reply.code(401).send(unauthorized());

    const action = (params.action ?? "").trim();

    switch (action) {
      case "":
      case "get_account_info":
        return {
          user_info: userInfo(line, base),
          server_info: serverInfo(base),
          logo: absUrl("/logo.svg", base),
          app_name: "StreamHub J.A.R.V.I.S.",
        };

      case "get_live_categories":
        return db
          .prepare("SELECT * FROM categories WHERE line_id = ? AND type = 'live' ORDER BY sort, name")
          .all(line.id)
          .map((c) => category(c as never));

      case "get_vod_categories":
        return db
          .prepare("SELECT * FROM categories WHERE line_id = ? AND type = 'vod' ORDER BY sort, name")
          .all(line.id)
          .map((c) => category(c as never));

      case "get_series_categories":
        return db
          .prepare("SELECT * FROM categories WHERE line_id = ? AND type = 'series' ORDER BY sort, name")
          .all(line.id)
          .map((c) => category(c as never));

      // ARRAY NUDO: le liste sono array, non oggetti avvolti. Alcuni client
      // rifiutano {user_info, server_info, data} e restano in caricamento.
      case "get_live_streams":
        return db
          .prepare("SELECT * FROM streams WHERE line_id = ? ORDER BY stream_id")
          .all(line.id)
          .map((row) => {
            const s = row as {
              stream_id: number | null;
              name: string;
              url: string;
              icon: string | null;
              epg_id: string | null;
              category_id: string | null;
            };
            return {
              num: Number(s.stream_id ?? 0),
              name: s.name,
              stream_type: "live",
              stream_id: Number(s.stream_id ?? 0),
              stream_icon: absUrl(s.icon, base),
              epg_channel_id: s.epg_id ?? "",
              added: String(now()),
              category_id: String(s.category_id ?? ""),
              custom_sid: "",
              tv_archive: 0,
              direct_source: s.url,
              tv_archive_duration: 0,
            };
          });

      case "get_vod_streams":
        return db
          .prepare("SELECT * FROM movies WHERE line_id = ? ORDER BY stream_id")
          .all(line.id)
          .map((row) => {
            const m = row as {
              stream_id: number | null;
              name: string;
              url: string;
              icon: string | null;
              category_id: string | null;
            };
            return {
              num: Number(m.stream_id ?? 0),
              name: m.name,
              stream_type: "movie",
              stream_id: Number(m.stream_id ?? 0),
              stream_icon: absUrl(m.icon, base),
              epg_channel_id: null,
              added: String(now()),
              category_id: String(m.category_id ?? ""),
              container_extension: extFromUrl(m.url),
              custom_sid: "",
              tv_archive: 0,
              direct_source: m.url,
              tv_archive_duration: 0,
            };
          });

      case "get_vod_info": {
        const m = db
          .prepare("SELECT * FROM movies WHERE line_id = ? AND stream_id = ?")
          .get(line.id, Number(params.vod_id ?? 0)) as
          | {
              stream_id: number;
              name: string;
              url: string;
              icon: string | null;
              plot: string | null;
              year: number | null;
              rating: number | null;
              duration: number | null;
              tmdb_id: number | null;
              category_id: string | null;
            }
          | undefined;
        if (!m) return {};
        return {
          info: {
            tmdb_id: m.tmdb_id ?? "",
            name: m.name,
            cover: absUrl(m.icon, base),
            plot: m.plot ?? "",
            cast: "",
            director: "",
            genre: "",
            releaseDate: m.year ? String(m.year) : "",
            rating: m.rating ?? "",
            rating_5based: m.rating ? Math.round((m.rating / 2) * 10) / 10 : "",
            runtime: m.duration ?? "",
            duration_secs: 0,
          },
          movie_data: {
            stream_id: Number(m.stream_id),
            name: m.name,
            added: String(now()),
            category_id: String(m.category_id ?? ""),
            container_extension: extFromUrl(m.url),
            custom_sid: "",
            direct_source: m.url,
          },
        };
      }

      case "get_series":
        return db
          .prepare("SELECT * FROM series WHERE line_id = ? ORDER BY series_id")
          .all(line.id)
          .map((row, index) => {
            const s = row as {
              series_id: number | null;
              name: string;
              cover: string | null;
              plot: string | null;
              year: number | null;
              rating: number | null;
              category_id: string | null;
            };
            return {
              num: index + 1,
              id: Number(s.series_id ?? 0),
              // series_id e' OBBLIGATORIO: senza, la griglia serie resta vuota.
              series_id: Number(s.series_id ?? 0),
              name: s.name,
              title: s.name,
              year: Number(s.year ?? 0),
              stream_type: "series",
              cover: absUrl(s.cover, base),
              plot: s.plot ?? "",
              cast: "",
              director: "",
              genre: "",
              releaseDate: s.year ? String(s.year) : "",
              release_date: s.year ? String(s.year) : "",
              last_modified: new Date().toISOString().replace("T", " ").slice(0, 19),
              rating: s.rating ?? "",
              rating_5based: s.rating ? Math.round((s.rating / 2) * 10) / 10 : "",
              backdrop_path: [],
              youtube_trailer: "",
              episode_run_time: "",
              category_id: String(s.category_id ?? ""),
              category_ids: [String(s.category_id ?? "")],
            };
          });

      case "get_series_info": {
        const serie = db
          .prepare("SELECT * FROM series WHERE line_id = ? AND series_id = ?")
          .get(line.id, Number(params.series_id ?? 0)) as
          | {
              id: string;
              series_id: number;
              name: string;
              cover: string | null;
              plot: string | null;
              year: number | null;
              rating: number | null;
              category_id: string | null;
            }
          | undefined;
        if (!serie) return { seasons: [], info: {}, episodes: {} };

        const rows = db
          .prepare("SELECT * FROM episodes WHERE series_id = ? ORDER BY season, num")
          .all(serie.id) as Array<{
          id: string;
          series_id: string;
          season: number;
          num: number;
          name: string;
          url: string | null;
          icon: string | null;
          plot: string | null;
          duration: number | null;
          stream_id: number | null;
        }>;

        const seasonsMap = new Map<number, typeof rows>();
        for (const ep of rows) {
          const list = seasonsMap.get(ep.season) ?? [];
          list.push(ep);
          seasonsMap.set(ep.season, list);
        }

        const seasons = [...seasonsMap.entries()].map(([num, list]) => ({
          season_number: num,
          name: `Stagione ${num}`,
          episode_count: list.length,
          id: Number(serie.series_id),
          air_date: "",
          cover: absUrl(serie.cover, base),
        }));

        const episodes: Record<string, unknown[]> = {};
        for (const [num, list] of seasonsMap) {
          episodes[String(num)] = list.map((ep) => ({
            id: Number(ep.stream_id ?? 0),
            episode_num: Number(ep.num),
            title: ep.name,
            container_extension: extFromUrl(ep.url ?? ""),
            info: {
              tmdb_id: "",
              release_date: "",
              plot: ep.plot ?? "",
              cover: absUrl(ep.icon ?? serie.cover, base),
              duration_secs: 0,
              season_number: Number(num),
              episode_number: Number(ep.num),
            },
            custom_sid: "",
            added: String(now()),
            season_number: Number(num),
            direct_source: ep.url ?? "",
          }));
        }

        return {
          seasons,
          info: {
            num: 1,
            id: Number(serie.series_id),
            series_id: Number(serie.series_id),
            name: serie.name,
            title: serie.name,
            year: Number(serie.year ?? 0),
            stream_type: "series",
            cover: absUrl(serie.cover, base),
            plot: serie.plot ?? "",
            cast: "",
            director: "",
            genre: "",
            releaseDate: serie.year ? String(serie.year) : "",
            release_date: serie.year ? String(serie.year) : "",
            last_modified: new Date().toISOString().replace("T", " ").slice(0, 19),
            rating: serie.rating ?? "",
            rating_5based: serie.rating ? Math.round((serie.rating / 2) * 10) / 10 : "",
            backdrop_path: [],
            youtube_trailer: "",
            episode_run_time: "",
            category_id: String(serie.category_id ?? ""),
            category_ids: [String(serie.category_id ?? "")],
          },
          episodes,
        };
      }

      case "get_short_episodes":
      case "get_blocked_ips":
        return [];

      default:
        return {};
    }
  });

  /** Cerca l'URL di un flusso per id numerico, dentro la linea. */
  function streamUrlOf(line: LineRow, streamId: string): string | null {
    const id = Number(streamId);
    if (!Number.isFinite(id)) return null;
    const movie = db
      .prepare("SELECT url FROM movies WHERE line_id = ? AND stream_id = ?")
      .get(line.id, id) as { url: string } | undefined;
    if (movie) return movie.url;
    const live = db
      .prepare("SELECT url FROM streams WHERE line_id = ? AND stream_id = ?")
      .get(line.id, id) as { url: string } | undefined;
    if (live) return live.url;
    const ep = db
      .prepare(
        "SELECT e.url FROM episodes e JOIN series s ON s.id = e.series_id WHERE s.line_id = ? AND e.stream_id = ?"
      )
      .get(line.id, id) as { url: string } | undefined;
    return ep?.url ?? null;
  }

  /** Gateway dei flussi: 302 verso la sorgente. */
  const gateway = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = readParams(req);
    const line = findLine(db, params.username, params.password);
    if (!line) return reply.code(401).send(unauthorized());

    const url = streamUrlOf(line, params.stream ?? "");
    if (!url) return reply.code(404).send({ error: "stream_not_found" });

    // La redirect usa lo STESSO protocollo della richiesta.
    return reply.redirect(url, 302);
  };

  app.get("/get.php", gateway);
  app.post("/get.php", gateway);

  /**
   * Path classico: /movie/{user}/{pass}/{id}.mp4
   * E' la forma che i player reali usano davvero.
   */
  app.get<{ Params: { kind: string; user: string; pass: string; id: string; ext: string } }>(
    "/:kind(movie|live|series|vod)/:user/:pass/:id.:ext",
    async (req, reply) => {
      const line = findLine(db, req.params.user, req.params.pass);
      if (!line) return reply.code(401).send(unauthorized());
      const url = streamUrlOf(line, req.params.id);
      if (!url) return reply.code(404).send({ error: "stream_not_found" });
      return reply.redirect(url, 302);
    }
  );

  /** EPG: se questa chiamata fallisce, alcuni player svuotano tutto il catalogo. */
  app.get("/xmltv.php", async (req, reply) => {
    const line = lineFrom(req, db);
    if (!line) return reply.code(401).send(unauthorized());

    const channels = db
      .prepare("SELECT * FROM streams WHERE line_id = ? ORDER BY stream_id")
      .all(line.id) as Array<{ stream_id: number; name: string; icon: string | null; epg_id: string | null }>;

    const fmt = (ts: number) =>
      new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19) + " +0000";
    const start = Math.floor(Date.now() / 1000);

    const out: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE tv SYSTEM "xmltv.dtd">',
      '<tv generator-info-name="StreamHub J.A.R.V.I.S.">',
    ];

    for (const c of channels) {
      const id = c.epg_id || String(c.stream_id);
      out.push(`  <channel id="${escapeXml(id)}">`);
      out.push(`    <display-name>${escapeXml(c.name)}</display-name>`);
      const icon = absUrl(c.icon, base);
      if (icon) out.push(`    <icon src="${escapeXml(icon)}" />`);
      out.push("  </channel>");
      for (let p = 0; p < 2; p++) {
        const s = start + p * 3600;
        out.push(
          `  <programme start="${fmt(s)}" stop="${fmt(s + 3600)}" channel="${escapeXml(id)}">`
        );
        out.push(`    <title>${escapeXml(c.name)}</title>`);
        out.push("  </programme>");
      }
    }
    out.push("</tv>");

    reply.type("application/xml; charset=utf-8");
    return out.join("\n");
  });

  app.get("/logo.svg", async (_req, reply) => {
    reply.type("image/svg+xml");
    return LOGO;
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#140508"/><circle cx="64" cy="64" r="30" fill="none" stroke="#F0B429" stroke-width="6"/><circle cx="64" cy="64" r="10" fill="#F0B429"/></svg>`;

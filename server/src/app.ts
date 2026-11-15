import Fastify, { type FastifyInstance } from "fastify";
import type { Db } from "./db/index.ts";
import type { Config } from "./config.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerLineRoutes } from "./routes/lines.ts";
import { registerXtreamRoutes } from "./xtream/routes.ts";
import { registerSourceRoutes } from "./routes/sources.ts";
import { registerCatalogRoutes } from "./routes/catalog.ts";
import { registerAdminRoutes } from "./routes/admin.ts";
import { tmdbFromEnv } from "./enrich/tmdb.ts";

export type AppDeps = { db: Db; config: Config };

export function createApp({ db, config }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: config.logLevel === "silent" ? false : { level: config.logLevel },
    bodyLimit: 1024 * 1024,
    // Il log di default di Fastify scrive l'URL completo, password compresa:
    // i player la mandano in chiaro nella query. Si usa solo il nostro hook,
    // che la maschera.
    disableRequestLogging: true,
  });

  app.get("/health", async () => ({ status: "ok", app: "StreamHub J.A.R.V.I.S." }));

  // CORS: serve al pannello quando è servito da un'altra origine (sviluppo,
  // app desktop). In produzione il web sta sulla stessa origine e non serve.
  // Le sessioni viaggiano su header Authorization, non su cookie cross-site.
  const allowed = (process.env.CORS_ORIGINS ?? "*").split(",").map((o) => o.trim());
  app.addHook("onRequest", async (req, reply) => {
    const origin = req.headers.origin;
    if (!origin) return;
    const ok = allowed.includes("*") || allowed.includes(origin);
    if (!ok) return;
    reply.header("access-control-allow-origin", origin);
    reply.header("vary", "origin");
    reply.header("access-control-allow-headers", "content-type, authorization");
    reply.header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
  });
  app.options("/*", async (_req, reply) => reply.code(204).send());

  registerAuthRoutes(app, db, config);
  registerLineRoutes(app, db, config);
  registerXtreamRoutes(app, db, config);
  const tmdb = tmdbFromEnv(process.env, config.tmdbCachePath);
  registerSourceRoutes(app, db, config, tmdb);
  registerCatalogRoutes(app, db);
  registerAdminRoutes(app, db);

  // Access log essenziale: chi chiede cosa, con che client e che Range.
  // Serve a capire il comportamento reale dei player (docs/client-contract.md).
  app.addHook("onResponse", async (req, reply) => {
    app.log.info(
      {
        method: req.method,
        url: req.url.replace(/password=[^&]*/gi, "password=***"),
        status: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
        userAgent: req.headers["user-agent"] ?? "",
        range: req.headers["range"] ?? "",
      },
      "access"
    );
  });

  app.setNotFoundHandler(async (req, reply) =>
    reply.code(404).send({ error: "not_found", message: `nessuna rotta per ${req.url}` })
  );

  app.setErrorHandler(async (err, _req, reply) => {
    app.log.error(err);
    return reply
      .code(err.statusCode ?? 500)
      .send({ error: "internal_error", message: "errore interno" });
  });

  return app;
}

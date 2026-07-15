import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { createCmsCore, type Clock } from "@astrocms/cms-core";
import type { Database } from "@astrocms/cms-database";
import { createFilesystemStorageDriver, type StorageDriver } from "@astrocms/storage";
import { registerCsrf } from "./csrf.js";
import type { Env } from "./env.js";
import { registerMetrics } from "./metrics.js";
import { authRoutes } from "./routes/auth.js";
import { auditRoutes } from "./routes/audit.js";
import { builderRoutes } from "./routes/builder.js";
import { healthRoutes } from "./routes/health.js";
import { mediaRoutes } from "./routes/media.js";
import { menuRoutes } from "./routes/menus.js";
import { pageRoutes } from "./routes/pages.js";
import { previewRoutes } from "./routes/preview.js";
import { publicRoutes } from "./routes/public.js";
import { settingsRoutes } from "./routes/settings.js";
import { taxonomyRoutes } from "./routes/taxonomies.js";
import { webhookRoutes } from "./routes/webhooks.js";
import "./types.js";

export interface BuildAppOptions {
  env: Env;
  db: Database;
  siteId: string;
  storage?: StorageDriver;
  clock?: Clock;
}

/** Composition root del borde HTTP: registra plugins, inyecta el núcleo y monta rutas. */
export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: opts.env.NODE_ENV === "test" ? "silent" : "info" },
    trustProxy: true,
  });

  const storage =
    opts.storage ??
    createFilesystemStorageDriver({ rootDir: opts.env.STORAGE_ROOT, publicBaseUrl: "/api/v1/media/file" });
  app.decorate(
    "core",
    createCmsCore({ db: opts.db, storage, ...(opts.clock ? { clock: opts.clock } : {}) }),
  );
  app.decorate("env", opts.env);
  app.decorate("siteId", opts.siteId);

  await app.register(cookie, { secret: opts.env.SESSION_SECRET });
  await app.register(cors, { origin: opts.env.ADMIN_ORIGIN, credentials: true });
  await app.register(multipart, { limits: { fileSize: opts.env.MEDIA_MAX_BYTES, files: 1 } });
  await app.register(rateLimit, { global: false, max: 100, timeWindow: "1 minute" });
  registerCsrf(app);

  registerMetrics(app);
  await healthRoutes(app, opts.db);

  await app.register(
    async (api) => {
      await authRoutes(api); // el rate limit estricto se aplica por-ruta sólo en /auth/login
      await auditRoutes(api);
      await pageRoutes(api);
      await mediaRoutes(api);
      await menuRoutes(api);
      await taxonomyRoutes(api);
      await settingsRoutes(api);
      await webhookRoutes(api);
      await builderRoutes(api);
      await previewRoutes(api);
      await publicRoutes(api);
    },
    { prefix: "/api/v1" },
  );

  return app;
}

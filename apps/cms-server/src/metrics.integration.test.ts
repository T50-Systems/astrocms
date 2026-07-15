import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCmsCore } from "@astrocms/cms-core";
import { createDb } from "@astrocms/cms-database";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

const DB = process.env.DATABASE_URL;

describe.skipIf(!DB)("Métricas Prometheus", () => {
  let app: FastifyInstance;
  let close: () => Promise<unknown>;

  beforeAll(async () => {
    process.env.SESSION_SECRET ??= "test-secret-of-32-characters-min!!";
    process.env.NODE_ENV = "test";
    const env = loadEnv();
    const connection = createDb(env.DATABASE_URL);
    close = connection.close;
    const siteId = await createCmsCore({ db: connection.db }).resolvePrimarySiteId();
    app = await buildApp({ env, db: connection.db, siteId });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await close();
  });

  it("expone métricas HTTP en formato Prometheus", async () => {
    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);

    const metrics = await app.inject({ method: "GET", url: "/metrics" });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.headers["content-type"]).toMatch(/^text\/plain; version=0\.0\.4/);
    expect(metrics.body).toContain("http_requests_total");
    expect(metrics.body).toContain("http_request_duration_seconds");
    expect(metrics.body).toContain('route="/healthz"');
  });
});

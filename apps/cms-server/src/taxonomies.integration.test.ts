import { randomUUID } from "node:crypto";
import type { FastifyInstance, InjectOptions } from "fastify";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCmsCore } from "@astrocms/cms-core";
import { createDb } from "@astrocms/cms-database";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

const DB = process.env.DATABASE_URL;

describe.skipIf(!DB)("API v1 — taxonomías (integración)", () => {
  let app: FastifyInstance;
  let close: () => Promise<unknown>;
  let cookies = "";
  let csrf = "";
  let pageId = "";
  let termId = "";
  const suffix = randomUUID().slice(0, 8);
  const pageSlug = `/tax-${suffix}`;
  const termSlug = `tax-${suffix}`;

  beforeAll(async () => {
    process.env.SESSION_SECRET ??= "test-secret-of-32-characters-min!!";
    process.env.NODE_ENV = "test";
    const env = loadEnv();
    const conn = createDb(env.DATABASE_URL);
    close = conn.close;
    const siteId = await createCmsCore({ db: conn.db }).resolvePrimarySiteId();
    app = await buildApp({ env, db: conn.db, siteId });
    await app.ready();

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@astrocms.local", password: "Admin!2345" },
    });
    expect(login.statusCode).toBe(200);
    jar(login);
  });

  afterAll(async () => {
    await app.close();
    await close();
  });

  const auth = (extra?: InjectOptions): InjectOptions => ({
    ...extra,
    headers: { cookie: cookies, "x-csrf-token": csrf, ...(extra?.headers ?? {}) },
  });

  const jar = (res: LightMyRequestResponse) => {
    const set = res.cookies as Array<{ name: string; value: string }>;
    cookies = set.map((c) => `${c.name}=${c.value}`).join("; ");
    csrf = set.find((c) => c.name === "astrocms_csrf")?.value ?? "";
  };

  it("crea un término category", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/taxonomies/category/terms",
      ...auth({ payload: { slug: termSlug, name: `Tax ${suffix}` } }),
    });
    expect(res.statusCode).toBe(201);
    termId = res.json().id;
    expect(res.json().slug).toBe(termSlug);
  });

  it("asigna el término a una página y lista sus términos", async () => {
    const page = await app.inject({
      method: "POST",
      url: "/api/v1/pages",
      ...auth({ payload: { title: `Tax page ${suffix}`, slug: pageSlug, editorType: "rich-text" } }),
    });
    expect(page.statusCode).toBe(201);
    pageId = page.json().id;

    const assigned = await app.inject({
      method: "PUT",
      url: `/api/v1/entries/${pageId}/terms`,
      ...auth({ payload: { termIds: [termId] } }),
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json()).toEqual([
      expect.objectContaining({ id: termId, slug: termSlug, name: `Tax ${suffix}` }),
    ]);

    const listed = await app.inject({ method: "GET", url: `/api/v1/entries/${pageId}/terms`, ...auth() });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual([
      expect.objectContaining({ id: termId, slug: termSlug, name: `Tax ${suffix}` }),
    ]);
  });

  it("publica GET /public/taxonomies/category con términos", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/public/taxonomies/category" });
    expect(res.statusCode).toBe(200);
    expect(res.json().key).toBe("category");
    expect(res.json().terms).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: termId, slug: termSlug, name: `Tax ${suffix}` })]),
    );
  });
});

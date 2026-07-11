import { randomUUID } from "node:crypto";
import type { FastifyInstance, InjectOptions } from "fastify";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCmsCore } from "@astrocms/cms-core";
import { createDb } from "@astrocms/cms-database";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

const DB = process.env.DATABASE_URL;

// Requiere Postgres (docker compose up postgres + migrate + seed).
describe.skipIf(!DB)("API v1 — flujo vertical (integración)", () => {
  let app: FastifyInstance;
  let close: () => Promise<unknown>;
  let cookies = "";
  let csrf = "";
  const slug = `/it-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    process.env.SESSION_SECRET ??= "test-secret-of-32-characters-min!!";
    process.env.NODE_ENV = "test";
    const env = loadEnv();
    const conn = createDb(env.DATABASE_URL);
    close = conn.close;
    const siteId = await createCmsCore({ db: conn.db }).resolvePrimarySiteId();
    app = await buildApp({ env, db: conn.db, siteId });
    await app.ready();
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

  it("rechaza login con contraseña incorrecta (401)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@astrocms.local", password: "malísima" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("login admin emite cookie de sesión y /me responde", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@astrocms.local", password: "Admin!2345" },
    });
    expect(res.statusCode).toBe(200);
    jar(res);
    expect(cookies).toContain("astrocms_session");

    const me = await app.inject({ method: "GET", url: "/api/v1/me", ...auth() });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe("admin@astrocms.local");
  });

  it("rechaza mutación sin CSRF (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/pages",
      headers: { cookie: cookies }, // sin x-csrf-token
      payload: { title: "X" },
    });
    expect(res.statusCode).toBe(403);
  });

  let pageId = "";
  it("crea página (draft) y no aparece en la API pública", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/pages",
      ...auth({ payload: { title: "Inicio Test", slug, editorType: "rich-text" } }),
    });
    expect(res.statusCode).toBe(201);
    pageId = res.json().id;
    expect(res.json().status).toBe("draft");

    const pub = await app.inject({ method: "GET", url: `/api/v1/public/pages?slug=${encodeURIComponent(slug)}` });
    expect(pub.statusCode).toBe(404); // draft no visible públicamente
  });

  it("publica y entonces sí aparece en la API pública", async () => {
    const res = await app.inject({ method: "POST", url: `/api/v1/pages/${pageId}/publish`, ...auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("published");

    const pub = await app.inject({ method: "GET", url: `/api/v1/public/pages?slug=${encodeURIComponent(slug)}` });
    expect(pub.statusCode).toBe(200);
    expect(pub.json().title).toBe("Inicio Test");
  });

  it("edita creando nueva versión y lista revisiones", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/pages/${pageId}`,
      ...auth({ payload: { title: "Inicio Editado" } }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().currentVersionNo).toBe(2);

    const revs = await app.inject({ method: "GET", url: `/api/v1/pages/${pageId}/revisions`, ...auth() });
    expect(revs.statusCode).toBe(200);
    expect(revs.json().length).toBeGreaterThanOrEqual(2);
  });

  it("restaura la versión 1 creando una nueva versión", async () => {
    const res = await app.inject({ method: "POST", url: `/api/v1/pages/${pageId}/restore/1`, ...auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("Inicio Test"); // contenido de v1
    expect(res.json().currentVersionNo).toBe(3);
  });
});

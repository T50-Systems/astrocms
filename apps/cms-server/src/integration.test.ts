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
  const authWith = (cookieHeader: string, csrfToken: string, extra?: InjectOptions): InjectOptions => ({
    ...extra,
    headers: { cookie: cookieHeader, "x-csrf-token": csrfToken, ...(extra?.headers ?? {}) },
  });
  const cookieHeader = (res: LightMyRequestResponse) => {
    const set = res.cookies as Array<{ name: string; value: string }>;
    return set.map((c) => `${c.name}=${c.value}`).join("; ");
  };
  const csrfFrom = (res: LightMyRequestResponse) => {
    const set = res.cookies as Array<{ name: string; value: string }>;
    return set.find((c) => c.name === "astrocms_csrf")?.value ?? "";
  };
  const jar = (res: LightMyRequestResponse) => {
    cookies = cookieHeader(res);
    csrf = csrfFrom(res);
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

  it("login crea una sesión listable sin exponer token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/me/sessions", ...auth() });
    expect(res.statusCode).toBe(200);
    const sessions = res.json() as Array<{ id: string; tokenHash?: string }>;
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions[0]?.id).toBeTruthy();
    expect(sessions[0]?.tokenHash).toBeUndefined();
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

  it("lista auditoría de publicación para la página", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/audit?entityType=entry&entityId=${pageId}`,
      ...auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: Array<{ action: string; entityId: string }> };
    expect(body.data.some((row) => row.action === "entry.published" && row.entityId === pageId)).toBe(true);
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

  it("revoca una segunda sesión y su cookie deja de autenticar", async () => {
    const before = await app.inject({ method: "GET", url: "/api/v1/me/sessions", ...auth() });
    expect(before.statusCode).toBe(200);
    const beforeIds = new Set((before.json() as Array<{ id: string }>).map((row) => row.id));

    const login2 = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@astrocms.local", password: "Admin!2345" },
    });
    expect(login2.statusCode).toBe(200);
    const secondCookies = cookieHeader(login2);
    const secondCsrf = csrfFrom(login2);

    const after = await app.inject({ method: "GET", url: "/api/v1/me/sessions", ...auth() });
    expect(after.statusCode).toBe(200);
    const second = (after.json() as Array<{ id: string }>).find((row) => !beforeIds.has(row.id));
    expect(second?.id).toBeTruthy();

    const revoked = await app.inject({
      method: "DELETE",
      url: `/api/v1/me/sessions/${second!.id}`,
      ...auth(),
    });
    expect(revoked.statusCode).toBe(204);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      ...authWith(secondCookies, secondCsrf),
    });
    expect(me.statusCode).toBe(401);
  });

  it("logout-all revoca todas las sesiones del usuario", async () => {
    const loginA = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@astrocms.local", password: "Admin!2345" },
    });
    expect(loginA.statusCode).toBe(200);
    const cookiesA = cookieHeader(loginA);
    const csrfA = csrfFrom(loginA);

    const loginB = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@astrocms.local", password: "Admin!2345" },
    });
    expect(loginB.statusCode).toBe(200);
    const cookiesB = cookieHeader(loginB);
    const csrfB = csrfFrom(loginB);

    const logoutAll = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout-all",
      ...authWith(cookiesA, csrfA),
    });
    expect(logoutAll.statusCode).toBe(204);

    const meA = await app.inject({ method: "GET", url: "/api/v1/me", ...authWith(cookiesA, csrfA) });
    expect(meA.statusCode).toBe(401);
    const meB = await app.inject({ method: "GET", url: "/api/v1/me", ...authWith(cookiesB, csrfB) });
    expect(meB.statusCode).toBe(401);
  });
});

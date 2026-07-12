import { createHmac, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import type { FastifyInstance, InjectOptions } from "fastify";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCmsCore } from "@astrocms/cms-core";
import { createDb, webhookDeliveries } from "@astrocms/cms-database";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

const DB = process.env.DATABASE_URL;

interface CapturedWebhook {
  body: string;
  signature: string;
}

function header(req: IncomingMessage, name: string): string {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

describe.skipIf(!DB)("API v1 — menús, ajustes y webhooks (integración)", () => {
  let app: FastifyInstance;
  let close: () => Promise<unknown>;
  let db: ReturnType<typeof createDb>["db"];
  let cookies = "";
  let csrf = "";
  const menuLocation = `primary-${randomUUID().slice(0, 8)}`;
  const settingsGroup = `site-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    process.env.SESSION_SECRET ??= "test-secret-of-32-characters-min!!";
    process.env.NODE_ENV = "test";
    const env = loadEnv();
    const conn = createDb(env.DATABASE_URL);
    db = conn.db;
    close = conn.close;
    const siteId = await createCmsCore({ db }).resolvePrimarySiteId();
    app = await buildApp({ env, db, siteId });
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

  it("upsert/get de menú y lectura pública", async () => {
    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/menus/${menuLocation}`,
      ...auth({
        payload: {
          name: "Primary",
          items: [{ label: "Inicio", linkType: "url", url: "/", target: "_self", children: [] }],
        },
      }),
    });
    expect(put.statusCode).toBe(200);
    expect((put.json() as { items: unknown[] }).items).toHaveLength(1);

    const get = await app.inject({ method: "GET", url: `/api/v1/menus/${menuLocation}`, ...auth() });
    expect(get.statusCode).toBe(200);
    expect((get.json() as { location: string }).location).toBe(menuLocation);

    const pub = await app.inject({ method: "GET", url: `/api/v1/public/menus/${menuLocation}` });
    expect(pub.statusCode).toBe(200);
    expect((pub.json() as { items: unknown[] }).items).toHaveLength(1);
  });

  it("rechaza urls de menú con esquemas peligrosos (400) y acepta relativas/http(s)", async () => {
    const location = `sec-${randomUUID().slice(0, 8)}`;
    const putBad = (url: string) =>
      app.inject({
        method: "PUT",
        url: `/api/v1/menus/${location}`,
        ...auth({ payload: { name: "Sec", items: [{ label: "X", linkType: "url", url, children: [] }] } }),
      });

    for (const url of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "//evil.example"]) {
      const res = await putBad(url);
      expect(res.statusCode).toBe(400);
      expect((res.json() as { error: { code: string } }).error.code).toBe("validation_error");
    }

    // Las válidas siguen funcionando (relativa y absoluta http/https), también anidadas.
    const ok = await app.inject({
      method: "PUT",
      url: `/api/v1/menus/${location}`,
      ...auth({
        payload: {
          name: "Sec",
          items: [
            { label: "Legal", linkType: "url", url: "/legal", children: [{ label: "Ext", linkType: "url", url: "https://example.com/x", children: [] }] },
          ],
        },
      }),
    });
    expect(ok.statusCode).toBe(200);

    await app.inject({ method: "DELETE", url: `/api/v1/menus/${location}`, ...auth() });
  });

  it("auto-añade páginas de nivel superior al publicar (autoAddPages)", async () => {
    const location = `auto-${randomUUID().slice(0, 8)}`;
    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/menus/${location}`,
      ...auth({ payload: { name: "Auto", autoAddPages: true, items: [] } }),
    });
    expect(put.statusCode).toBe(200);
    expect((put.json() as { autoAddPages: boolean }).autoAddPages).toBe(true);

    // Página top-level publicada → se añade al menú.
    const slug = `/auto-${randomUUID().slice(0, 8)}`;
    const page = await app.inject({
      method: "POST",
      url: "/api/v1/pages",
      ...auth({ payload: { title: "Auto añadida", slug, editorType: "rich-text" } }),
    });
    const pageId = (page.json() as { id: string }).id;
    const pub1 = await app.inject({ method: "POST", url: `/api/v1/pages/${pageId}/publish`, ...auth() });
    expect(pub1.statusCode).toBe(200);

    const menu1 = await app.inject({ method: "GET", url: `/api/v1/menus/${location}`, ...auth() });
    const items1 = (menu1.json() as { items: Array<{ entryId?: string; label: string }> }).items;
    expect(items1.some((i) => i.entryId === pageId && i.label === "Auto añadida")).toBe(true);

    // Re-publicar no duplica.
    await app.inject({ method: "POST", url: `/api/v1/pages/${pageId}/unpublish`, ...auth() });
    await app.inject({ method: "POST", url: `/api/v1/pages/${pageId}/publish`, ...auth() });
    const menu2 = await app.inject({ method: "GET", url: `/api/v1/menus/${location}`, ...auth() });
    const items2 = (menu2.json() as { items: Array<{ entryId?: string }> }).items;
    expect(items2.filter((i) => i.entryId === pageId)).toHaveLength(1);

    // Página anidada NO se añade.
    const nested = await app.inject({
      method: "POST",
      url: "/api/v1/pages",
      ...auth({ payload: { title: "Anidada", slug: `${slug}/hija`, editorType: "rich-text" } }),
    });
    const nestedId = (nested.json() as { id: string }).id;
    await app.inject({ method: "POST", url: `/api/v1/pages/${nestedId}/publish`, ...auth() });
    const menu3 = await app.inject({ method: "GET", url: `/api/v1/menus/${location}`, ...auth() });
    expect((menu3.json() as { items: Array<{ entryId?: string }> }).items.some((i) => i.entryId === nestedId)).toBe(false);

    // limpieza
    await app.inject({ method: "DELETE", url: `/api/v1/menus/${location}`, ...auth() });
    await app.inject({ method: "DELETE", url: `/api/v1/pages/${pageId}`, ...auth() });
    await app.inject({ method: "DELETE", url: `/api/v1/pages/${nestedId}`, ...auth() });
  });

  it("persiste propiedades avanzadas del item (meta) en el round-trip", async () => {
    const location = `adv-${randomUUID().slice(0, 8)}`;
    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/menus/${location}`,
      ...auth({
        payload: {
          name: "Avanzado",
          items: [{
            label: "Docs",
            linkType: "url",
            url: "/docs",
            cssClasses: ["destacado", "cta"],
            titleAttr: "Documentación",
            description: "Guías y referencia",
            children: [],
          }],
        },
      }),
    });
    expect(put.statusCode).toBe(200);
    const item = (put.json() as { items: Array<Record<string, unknown>> }).items[0]!;
    expect(item.cssClasses).toEqual(["destacado", "cta"]);
    expect(item.titleAttr).toBe("Documentación");
    expect(item.description).toBe("Guías y referencia");

    const get = await app.inject({ method: "GET", url: `/api/v1/menus/${location}`, ...auth() });
    const round = (get.json() as { items: Array<Record<string, unknown>> }).items[0]!;
    expect(round.cssClasses).toEqual(["destacado", "cta"]);

    await app.inject({ method: "DELETE", url: `/api/v1/menus/${location}`, ...auth() });
  });

  it("elimina un menú (204) y responde 404 después", async () => {
    const location = `del-${randomUUID().slice(0, 8)}`;
    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/menus/${location}`,
      ...auth({ payload: { name: "Borrable", items: [{ label: "X", linkType: "url", url: "/x", children: [] }] } }),
    });
    expect(put.statusCode).toBe(200);

    const del = await app.inject({ method: "DELETE", url: `/api/v1/menus/${location}`, ...auth() });
    expect(del.statusCode).toBe(204);

    const gone = await app.inject({ method: "GET", url: `/api/v1/menus/${location}`, ...auth() });
    expect(gone.statusCode).toBe(404);

    const again = await app.inject({ method: "DELETE", url: `/api/v1/menus/${location}`, ...auth() });
    expect(again.statusCode).toBe(404);
  });

  it("resuelve url del entry en items de menú y marca invalid al borrarlo", async () => {
    const slug = `/menu-link-${randomUUID().slice(0, 8)}`;
    const page = await app.inject({
      method: "POST",
      url: "/api/v1/pages",
      ...auth({ payload: { title: "Página enlazada", slug, editorType: "rich-text" } }),
    });
    expect(page.statusCode).toBe(201);
    const pageId = (page.json() as { id: string }).id;

    const location = `loc-${randomUUID().slice(0, 8)}`;
    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/menus/${location}`,
      ...auth({
        payload: { name: "Con entry", items: [{ label: "Enlazada", linkType: "entry", entryId: pageId, children: [] }] },
      }),
    });
    expect(put.statusCode).toBe(200);
    const item = (put.json() as { items: Array<{ url?: string; invalid?: boolean }> }).items[0]!;
    expect(item.url).toBe(slug); // url calculada desde el slug del entry
    expect(item.invalid).toBeUndefined();

    // Borrar la página → FK set null → el item queda marcado como roto.
    const del = await app.inject({ method: "DELETE", url: `/api/v1/pages/${pageId}`, ...auth() });
    expect(del.statusCode).toBe(204);

    const after = await app.inject({ method: "GET", url: `/api/v1/menus/${location}`, ...auth() });
    expect(after.statusCode).toBe(200);
    const broken = (after.json() as { items: Array<{ url?: string; invalid?: boolean }> }).items[0]!;
    expect(broken.invalid).toBe(true);
    expect(broken.url).toBeUndefined();
  });

  it("set/get de settings y lectura pública", async () => {
    const values = { title: "AstroCMS Test", description: "Descripción desde integración" };
    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/settings/${settingsGroup}`,
      ...auth({ payload: { values } }),
    });
    expect(put.statusCode).toBe(200);
    expect((put.json() as { values: typeof values }).values.title).toBe(values.title);

    const get = await app.inject({ method: "GET", url: `/api/v1/settings/${settingsGroup}`, ...auth() });
    expect(get.statusCode).toBe(200);
    expect((get.json() as { values: typeof values }).values.description).toBe(values.description);

    const pub = await app.inject({ method: "GET", url: `/api/v1/public/settings/${settingsGroup}` });
    expect(pub.statusCode).toBe(200);
    expect((pub.json() as { values: typeof values }).values.title).toBe(values.title);
  });

  it("dispara webhook al publicar página, firma HMAC y registra delivery", async () => {
    const captures: CapturedWebhook[] = [];
    const receiver = createServer(async (req, res) => {
      const body = await readBody(req);
      captures.push({ body, signature: header(req, "x-astrocms-signature") });
      res.statusCode = 204;
      res.end();
    });
    await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve));
    const address = receiver.address() as AddressInfo;
    const secret = `secret-${randomUUID()}`;

    try {
      const createdHook = await app.inject({
        method: "POST",
        url: "/api/v1/webhooks",
        ...auth({
          payload: { event: "entry.published", targetUrl: `http://127.0.0.1:${address.port}/hook`, secret },
        }),
      });
      expect(createdHook.statusCode).toBe(201);
      const webhookId = (createdHook.json() as { id: string }).id;

      const slug = `/wh-${randomUUID().slice(0, 8)}`;
      const page = await app.inject({
        method: "POST",
        url: "/api/v1/pages",
        ...auth({ payload: { title: "Webhook Page", slug, editorType: "rich-text" } }),
      });
      expect(page.statusCode).toBe(201);
      const pageId = (page.json() as { id: string }).id;

      const published = await app.inject({ method: "POST", url: `/api/v1/pages/${pageId}/publish`, ...auth() });
      expect(published.statusCode).toBe(200);

      const received = captures.find((capture) => (JSON.parse(capture.body) as { data?: { id?: string } }).data?.id === pageId);
      expect(received).toBeDefined();
      if (!received) throw new Error("webhook no capturado");
      const expected = createHmac("sha256", secret).update(received.body).digest("hex");
      expect(received.signature).toBe(expected);
      expect((JSON.parse(received.body) as { event: string }).event).toBe("entry.published");

      const deliveries = (
        await db
        .select()
        .from(webhookDeliveries)
          .where(eq(webhookDeliveries.webhookId, webhookId))
      ).filter((delivery) => (delivery.payload as { data?: { id?: string } }).data?.id === pageId);
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]?.statusCode).toBe(204);
      expect(deliveries[0]?.attempt).toBe(1);
    } finally {
      await new Promise<void>((resolve, reject) => receiver.close((err) => (err ? reject(err) : resolve())));
    }
  });
});

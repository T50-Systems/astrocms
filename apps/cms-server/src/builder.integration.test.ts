import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BlockManifest, BuilderNode } from "@astrocms/contracts";
import { createEngine } from "@astrocms/builder-core";
import { createCmsBuilderAdapter } from "@astrocms/builder-adapters";
import { createCmsClient } from "@astrocms/cms-sdk";
import { createCmsCore } from "@astrocms/cms-core";
import { createDb } from "@astrocms/cms-database";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

const DB = process.env.DATABASE_URL;

const manifest: BlockManifest = {
  schemaVersion: 1,
  tokens: { spacing: [], widths: [], columns: [], colors: [], breakpoints: ["desktop"] },
  blocks: [],
};

const rootWithHero = (title: string): BuilderNode => ({
  id: "root",
  type: "core/page",
  version: 1,
  props: {},
  children: [{ id: "hero1", type: "site/hero", version: 1, props: { title }, children: [] }],
});

describe.skipIf(!DB)("Builder ↔ CMS (integración end-to-end)", () => {
  let app: FastifyInstance;
  let close: () => Promise<unknown>;

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

  it("engine → cmsBuilderAdapter → SDK → API → DB (draft, versión, publish, restore)", async () => {
    // Login para obtener cookie + csrf.
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@astrocms.local", password: "Admin!2345" },
    });
    const cookieJar = (login.cookies as Array<{ name: string; value: string }>);
    const cookie = cookieJar.map((c) => `${c.name}=${c.value}`).join("; ");
    const csrf = cookieJar.find((c) => c.name === "astrocms_csrf")?.value ?? "";

    // CmsClient cuyo fetch delega en app.inject (ejercita todo el stack HTTP).
    const cms = createCmsClient({
      baseUrl: "/api/v1",
      getCsrfToken: () => csrf,
      fetch: async (target, init) => {
        const res = await app.inject({
          method: (init?.method ?? "GET") as "GET",
          url: String(target),
          headers: { ...(init?.headers as Record<string, string>), cookie },
          ...(init?.body ? { payload: init.body as string } : {}),
        });
        return new Response(res.payload || null, {
          status: res.statusCode,
          headers: { "content-type": res.headers["content-type"]?.toString() ?? "application/json" },
        });
      },
    });

    // Crear documento vía SDK; envolver en el adaptador del CMS.
    const created = await cms.builder.create(rootWithHero("Título original"));
    const adapter = createCmsBuilderAdapter(cms);

    // Cargar, editar con el engine, guardar draft.
    const loaded = await adapter.loadDocument(created.id);
    const engine = createEngine(loaded, { manifest });
    engine.dispatch({ kind: "setProp", nodeId: "hero1", path: "props.title", value: "Editado" });
    await adapter.saveDraft(engine.getState().document);

    // Debe haber ≥2 revisiones; la actual refleja la edición.
    const revs = await adapter.getRevisionHistory(created.id);
    expect(revs.length).toBeGreaterThanOrEqual(2);
    const afterSave = await adapter.loadDocument(created.id);
    expect(afterSave.root.children[0]?.props.title).toBe("Editado");

    // Publicar → la última revisión queda publicada.
    await adapter.publish(created.id);
    expect((await adapter.getRevisionHistory(created.id))[0]?.isPublished).toBe(true);

    // Restaurar la v1 → vuelve el título original en una nueva versión.
    const restored = await adapter.restoreRevision(created.id, "1");
    expect(restored.root.children[0]?.props.title).toBe("Título original");
  });
});

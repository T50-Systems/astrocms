import { randomUUID } from "node:crypto";
import type { FastifyInstance, InjectOptions } from "fastify";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCmsCore } from "@astrocms/cms-core";
import { createDb } from "@astrocms/cms-database";
import type { TaxonomyDetail, Term } from "@astrocms/contracts";
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
  const tagSlug = `tag-${suffix}`;
  const categoryDescription = `Descripción categoría ${suffix}`;
  const tagDescription = `Descripción etiqueta ${suffix}`;

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

  const findTerm = (terms: Term[], id: string): Term | undefined => {
    for (const term of terms) {
      if (term.id === id) return term;
      const child = findTerm(term.children ?? [], id);
      if (child) return child;
    }
    return undefined;
  };

  it("crea un término category con descripción", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/taxonomies/category/terms",
      ...auth({ payload: { slug: termSlug, name: `Tax ${suffix}`, description: categoryDescription } }),
    });
    expect(res.statusCode).toBe(201);
    termId = res.json().id;
    expect(res.json().slug).toBe(termSlug);

    const get = await app.inject({ method: "GET", url: "/api/v1/taxonomies/category", ...auth() });
    expect(get.statusCode).toBe(200);
    const taxonomy = get.json() as TaxonomyDetail;
    const term = findTerm(taxonomy.terms, termId);
    expect(term).toEqual(expect.objectContaining({ id: termId, description: categoryDescription, count: 0 }));
  });

  it("asigna el término a una página y actualiza su cantidad", async () => {
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

    const taxonomy = await app.inject({ method: "GET", url: "/api/v1/taxonomies/category", ...auth() });
    expect(taxonomy.statusCode).toBe(200);
    const term = findTerm((taxonomy.json() as TaxonomyDetail).terms, termId);
    expect(term?.count).toBeGreaterThanOrEqual(1);
  });

  it("crea una etiqueta en tag y la lista por API privada y pública", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/taxonomies/tag/terms",
      ...auth({ payload: { slug: tagSlug, name: `Tag ${suffix}`, description: tagDescription } }),
    });
    expect(created.statusCode).toBe(201);
    const tagId = created.json().id as string;

    const privateRes = await app.inject({ method: "GET", url: "/api/v1/taxonomies/tag", ...auth() });
    expect(privateRes.statusCode).toBe(200);
    expect(privateRes.json()).toEqual(
      expect.objectContaining({
        key: "tag",
        hierarchical: false,
        terms: expect.arrayContaining([
          expect.objectContaining({ id: tagId, slug: tagSlug, name: `Tag ${suffix}`, description: tagDescription, count: 0 }),
        ]),
      }),
    );

    const publicRes = await app.inject({ method: "GET", url: "/api/v1/public/taxonomies/tag" });
    expect(publicRes.statusCode).toBe(200);
    expect(publicRes.json()).toEqual(
      expect.objectContaining({
        key: "tag",
        terms: expect.arrayContaining([expect.objectContaining({ id: tagId, slug: tagSlug, description: tagDescription })]),
      }),
    );
  });

  it("publica GET /public/taxonomies/category con términos", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/public/taxonomies/category" });
    expect(res.statusCode).toBe(200);
    expect(res.json().key).toBe("category");
    expect(res.json().terms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: termId, slug: termSlug, name: `Tax ${suffix}`, description: categoryDescription }),
      ]),
    );
  });

  it("edita (upsert por slug) y elimina un término", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/taxonomies/category/terms",
      ...auth({ payload: { name: `Borrable ${suffix}` } }),
    });
    expect(created.statusCode).toBe(201);
    const term = created.json() as { id: string; slug: string };

    // Editar: mismo slug, nuevo nombre/descripción -> actualiza en sitio.
    const edited = await app.inject({
      method: "POST",
      url: "/api/v1/taxonomies/category/terms",
      ...auth({ payload: { slug: term.slug, name: `Editado ${suffix}`, description: "nueva desc" } }),
    });
    expect(edited.statusCode).toBe(201);
    expect(edited.json().id).toBe(term.id);
    expect(edited.json().name).toBe(`Editado ${suffix}`);

    // Eliminar.
    const del = await app.inject({ method: "DELETE", url: `/api/v1/taxonomies/category/terms/${term.id}`, ...auth() });
    expect(del.statusCode).toBe(204);

    const after = await app.inject({ method: "GET", url: "/api/v1/taxonomies/category", ...auth() });
    const stillThere = (after.json() as TaxonomyDetail).terms.some((t) => t.id === term.id);
    expect(stillThere).toBe(false);

    // Borrar de nuevo -> 404.
    const gone = await app.inject({ method: "DELETE", url: `/api/v1/taxonomies/category/terms/${term.id}`, ...auth() });
    expect(gone.statusCode).toBe(404);
  });
});

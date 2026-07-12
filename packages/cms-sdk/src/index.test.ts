import { describe, expect, it, vi } from "vitest";
import { createCmsClient } from "./index.js";

function fakeFetch(status: number, body: unknown) {
  return vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(
      new Response(body === undefined ? "" : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

describe("cms-sdk", () => {
  it("construye la query de listado", async () => {
    const f = fakeFetch(200, { data: [], page: 1, pageSize: 20, total: 0 });
    const cms = createCmsClient({ baseUrl: "/api/v1", fetch: f });
    await cms.pages.list({ status: "published", search: "inicio", page: 2 });
    expect(f).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/pages?status=published&search=inicio&page=2"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("consulta contadores de páginas", async () => {
    const f = fakeFetch(200, { all: 2, draft: 1, published: 1, archived: 0 });
    const cms = createCmsClient({ baseUrl: "/api/v1", fetch: f });
    await expect(cms.pages.counts()).resolves.toEqual({ all: 2, draft: 1, published: 1, archived: 0 });
    expect(f).toHaveBeenCalledWith(
      "/api/v1/pages/counts",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("adjunta CSRF en mutaciones vía getCsrfToken", async () => {
    const f = fakeFetch(201, { id: "e1" });
    const cms = createCmsClient({ baseUrl: "/api/v1", fetch: f, getCsrfToken: () => "tok" });
    await cms.pages.create({ contentTypeKey: "page", title: "X", editorType: "rich-text" });
    const init = f.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({ "x-csrf-token": "tok" });
  });

  it("public.getPageBySlug devuelve null en 404", async () => {
    const f = fakeFetch(404, { error: { code: "not_found", message: "x" } });
    const cms = createCmsClient({ baseUrl: "http://host/api/v1", fetch: f });
    expect(await cms.public.getPageBySlug("/nope")).toBeNull();
  });
});

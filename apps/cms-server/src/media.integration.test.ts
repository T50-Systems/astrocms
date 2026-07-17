import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { FastifyInstance, InjectOptions } from "fastify";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCmsCore } from "@astrocms/cms-core";
import { createDb, mediaAssets, mediaVariants, type Database } from "@astrocms/cms-database";
import { createFilesystemStorageDriver } from "@astrocms/storage";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

const DB = process.env.DATABASE_URL;
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR42mP8z8AABQMBgAErA0mPAAAAAElFTkSuQmCC",
  "base64",
);

function multipartFile(name: string, filename: string, mime: string, bytes: Buffer) {
  const boundary = `astrocms-${randomUUID()}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, bytes, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

describe.skipIf(!DB)("API v1 — media library (integración)", () => {
  let app: FastifyInstance;
  let close: () => Promise<unknown>;
  let db: Database;
  let storageRoot = "";
  let cookies = "";
  let csrf = "";

  beforeAll(async () => {
    process.env.SESSION_SECRET ??= "test-secret-of-32-characters-min!!";
    process.env.NODE_ENV = "test";
    storageRoot = await mkdtemp(path.join(os.tmpdir(), "astrocms-media-"));
    const env = loadEnv({ ...process.env, STORAGE_ROOT: storageRoot });
    const conn = createDb(env.DATABASE_URL);
    db = conn.db;
    close = conn.close;
    const siteId = await createCmsCore({ db }).resolvePrimarySiteId();
    app = await buildApp({
      env,
      db,
      siteId,
      storage: createFilesystemStorageDriver({ rootDir: storageRoot, publicBaseUrl: "/api/v1/media/file" }),
    });
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
    await rm(storageRoot, { recursive: true, force: true });
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

  it("sube PNG, genera variantes, lista, obtiene, sirve binario y borra", async () => {
    const body = multipartFile("file", "tiny.png", "image/png", PNG_1X1);
    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/media",
      ...auth({ payload: body.payload, headers: body.headers }),
    });
    expect(upload.statusCode).toBe(201);
    const asset = upload.json();
    expect(asset.mime).toBe("image/png");
    expect(asset.bytes).toBe(PNG_1X1.byteLength);
    expect(asset.variants).toHaveLength(3);
    expect(asset.url).toContain("/api/v1/media/file/");

    const row = (await db.select().from(mediaAssets).where(eq(mediaAssets.id, asset.id)).limit(1))[0];
    expect(row?.checksumSha256).toBe(createHash("sha256").update(PNG_1X1).digest("hex"));
    const variants = await db.select().from(mediaVariants).where(eq(mediaVariants.assetId, asset.id));
    expect(variants.map((variant) => variant.kind).sort()).toEqual(["md", "thumb", "webp"]);

    const list = await app.inject({ method: "GET", url: "/api/v1/media?mime=image/", ...auth() });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.some((item: { id: string }) => item.id === asset.id)).toBe(true);

    const get = await app.inject({ method: "GET", url: `/api/v1/media/${asset.id}`, ...auth() });
    expect(get.statusCode).toBe(200);
    expect(get.json().id).toBe(asset.id);

    const fileUrl = new URL(asset.url, "http://internal");
    const file = await app.inject({ method: "GET", url: fileUrl.pathname, ...auth() });
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-type"]).toContain("image/png");

    const del = await app.inject({ method: "DELETE", url: `/api/v1/media/${asset.id}`, ...auth() });
    expect(del.statusCode).toBe(204);
    const gone = await app.inject({ method: "GET", url: `/api/v1/media/${asset.id}`, ...auth() });
    expect(gone.statusCode).toBe(404);
  });

  it("sube a carpeta, la lista en /folders, mueve entre carpetas y filtra", async () => {
    const folder = `Carpeta-${randomUUID().slice(0, 6)}`;
    const boundary = `astrocms-${randomUUID()}`;
    const filePart =
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="f.png"\r\nContent-Type: image/png\r\n\r\n`;
    const folderPart = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\n${folder}`;
    const payload = Buffer.concat([Buffer.from(filePart), PNG_1X1, Buffer.from(folderPart), Buffer.from(`\r\n--${boundary}--\r\n`)]);

    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/media",
      ...auth({ payload, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } }),
    });
    expect(upload.statusCode).toBe(201);
    const asset = upload.json();
    expect(asset.folder).toBe(folder);

    const folders = await app.inject({ method: "GET", url: "/api/v1/media/folders", ...auth() });
    expect(folders.statusCode).toBe(200);
    expect((folders.json() as Array<{ name: string; count: number }>).some((f) => f.name === folder && f.count >= 1)).toBe(true);

    const filtered = await app.inject({ method: "GET", url: `/api/v1/media?folder=${encodeURIComponent(folder)}`, ...auth() });
    expect(filtered.json().data.every((item: { folder?: string }) => item.folder === folder)).toBe(true);

    // mover fuera de la carpeta (folder: null)
    const moved = await app.inject({
      method: "PATCH",
      url: `/api/v1/media/${asset.id}`,
      ...auth({ payload: { folder: null } }),
    });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().folder).toBeUndefined();

    await app.inject({ method: "DELETE", url: `/api/v1/media/${asset.id}`, ...auth() });
  });

  it("expone metadata pública acotada por id sin autenticación", async () => {
    const body = multipartFile("file", "public.png", "image/png", PNG_1X1);
    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/media",
      ...auth({ payload: body.payload, headers: body.headers }),
    });
    expect(upload.statusCode).toBe(201);
    const uploaded = upload.json();
    const updated = await app.inject({
      method: "PATCH",
      url: `/api/v1/media/${uploaded.id}`,
      ...auth({ payload: { alt: "Imagen pública" } }),
    });
    expect(updated.statusCode).toBe(200);

    const publicGet = await app.inject({ method: "GET", url: `/api/v1/public/media/${uploaded.id}` });
    expect(publicGet.statusCode).toBe(200);
    const asset = publicGet.json();
    expect(asset).toMatchObject({
      id: uploaded.id,
      url: uploaded.url,
      alt: "Imagen pública",
      width: 1,
      height: 1,
    });
    expect(Object.keys(asset).sort()).toEqual(["alt", "height", "id", "url", "variants", "width"]);
    expect(asset).not.toHaveProperty("filename");
    expect(asset).not.toHaveProperty("folder");
    expect(asset).not.toHaveProperty("bytes");
    expect(asset).not.toHaveProperty("mime");
    expect(asset.variants).toHaveLength(3);
    for (const variant of asset.variants) {
      expect(Object.keys(variant).sort()).toEqual(["height", "kind", "url", "width"]);
    }

    const missing = await app.inject({ method: "GET", url: `/api/v1/public/media/${randomUUID()}` });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("not_found");

    await app.inject({ method: "DELETE", url: `/api/v1/media/${uploaded.id}`, ...auth() });
  });

  it("rechaza extensión PNG con bytes que no son imagen", async () => {
    const body = multipartFile("file", "fake.png", "image/png", Buffer.from("not an image"));
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/media",
      ...auth({ payload: body.payload, headers: body.headers }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("validation_error");
  });
});

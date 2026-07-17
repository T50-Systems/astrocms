import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import sharp from "sharp";
import type { MediaAsset, MediaFolder, MediaQuery, MediaVariant, Paginated, UpdateMediaRequest } from "@astrocms/contracts";
import { mediaAssets, mediaVariants } from "@astrocms/cms-database";
import type { Database } from "@astrocms/cms-database";
import type { StorageDriver } from "@astrocms/storage";
import { notFound, validation } from "./errors.js";
import type { Clock } from "./ports.js";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/tiff"]);

type AssetRow = typeof mediaAssets.$inferSelect;
type VariantRow = typeof mediaVariants.$inferSelect;

interface GeneratedVariant {
  kind: "thumb" | "md" | "webp";
  storageKey: string;
  bytes: Buffer;
  width: number | null;
  height: number | null;
  mime: string;
}

function checksumSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeFilename(filename: string): string {
  const normalized = filename.replaceAll("\\", "/").split("/").at(-1)?.trim();
  return normalized && normalized.length > 0 ? normalized : "upload";
}

function storageKey(siteId: string, assetId: string, kind: string, ext: string): string {
  return `media-${siteId}-${assetId}-${kind}.${ext}`;
}

function detectImageType(bytes: Uint8Array): { mime: string; ext: string } | undefined {
  const hex = (index: number) => bytes[index]?.toString(16).padStart(2, "0") ?? "";
  const signature = Array.from({ length: Math.min(bytes.byteLength, 12) }, (_, index) => hex(index)).join("");
  if (signature.startsWith("89504e470d0a1a0a")) return { mime: "image/png", ext: "png" };
  if (signature.startsWith("ffd8ff")) return { mime: "image/jpeg", ext: "jpg" };
  if (signature.startsWith("474946383761") || signature.startsWith("474946383961")) {
    return { mime: "image/gif", ext: "gif" };
  }
  if (signature.startsWith("52494646") && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    bytes[8] === 0x61 &&
    bytes[9] === 0x76 &&
    bytes[10] === 0x69 &&
    bytes[11] === 0x66
  ) {
    return { mime: "image/avif", ext: "avif" };
  }
  if (signature.startsWith("49492a00") || signature.startsWith("4d4d002a")) return { mime: "image/tiff", ext: "tif" };
  return undefined;
}

function toVariant(row: VariantRow, storage: StorageDriver): MediaVariant {
  return {
    kind: row.kind,
    url: storage.url(row.storageKey),
    ...(row.width ? { width: row.width } : {}),
    ...(row.height ? { height: row.height } : {}),
  };
}

function toAsset(row: AssetRow, variants: VariantRow[], storage: StorageDriver): MediaAsset {
  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    bytes: row.bytes,
    ...(row.width ? { width: row.width } : {}),
    ...(row.height ? { height: row.height } : {}),
    ...(row.alt ? { alt: row.alt } : {}),
    ...(row.title ? { title: row.title } : {}),
    ...(row.folder ? { folder: row.folder } : {}),
    url: storage.url(row.storageKey),
    variants: variants.map((variant) => toVariant(variant, storage)),
    createdAt: row.createdAt.toISOString(),
  };
}

async function imageMetadata(bytes: Uint8Array): Promise<{ width: number | null; height: number | null }> {
  const metadata = await sharp(bytes, { failOn: "error" }).metadata();
  return { width: metadata.width ?? null, height: metadata.height ?? null };
}

async function generateVariant(
  source: Uint8Array,
  kind: GeneratedVariant["kind"],
  key: string,
  mime: string,
): Promise<GeneratedVariant> {
  const pipeline = sharp(source, { failOn: "error" });
  const output =
    kind === "webp"
      ? await pipeline.webp().toBuffer({ resolveWithObject: true })
      : await pipeline
          .resize({ width: kind === "thumb" ? 200 : 800, withoutEnlargement: true })
          .toBuffer({ resolveWithObject: true });
  return {
    kind,
    storageKey: key,
    bytes: output.data,
    width: output.info.width,
    height: output.info.height,
    mime: kind === "webp" ? "image/webp" : mime,
  };
}

export function createMediaService(db: Database, storage: StorageDriver, clock: Clock) {
  async function variantsFor(assetId: string): Promise<VariantRow[]> {
    return db.select().from(mediaVariants).where(eq(mediaVariants.assetId, assetId));
  }

  async function loadAsset(id: string, siteId?: string): Promise<AssetRow> {
    const where = siteId ? and(eq(mediaAssets.id, id), eq(mediaAssets.siteId, siteId)) : eq(mediaAssets.id, id);
    const row = (await db.select().from(mediaAssets).where(where).limit(1))[0];
    if (!row) throw notFound("media asset no existe");
    return row;
  }

  return {
    async upload(
      bytes: Uint8Array,
      filename: string,
      mime: string,
      userId: string,
      siteId: string,
      meta?: { alt?: string; folder?: string },
    ): Promise<MediaAsset> {
      if (bytes.byteLength === 0) throw validation("archivo vacío");
      if (bytes.byteLength > MAX_UPLOAD_BYTES) throw validation("archivo excede el límite de tamaño");

      const detected = detectImageType(bytes);
      if (!detected || !IMAGE_MIME.has(detected.mime)) throw validation("tipo de archivo no soportado");
      if (detected.mime !== mime) throw validation("MIME declarado no coincide con los bytes reales");

      const assetId = randomUUID();
      const originalKey = storageKey(siteId, assetId, "original", detected.ext);
      const metadata = await imageMetadata(bytes);
      const generated = await Promise.all([
        generateVariant(bytes, "thumb", storageKey(siteId, assetId, "thumb", detected.ext), detected.mime),
        generateVariant(bytes, "md", storageKey(siteId, assetId, "md", detected.ext), detected.mime),
        generateVariant(bytes, "webp", storageKey(siteId, assetId, "webp", "webp"), detected.mime),
      ]);
      const storedKeys = [originalKey, ...generated.map((variant) => variant.storageKey)];

      try {
        await storage.put(originalKey, bytes, detected.mime);
        for (const variant of generated) {
          await storage.put(variant.storageKey, variant.bytes, variant.mime);
        }

        await db.transaction(async (tx) => {
          await tx.insert(mediaAssets).values({
            id: assetId,
            siteId,
            storageKey: originalKey,
            filename: safeFilename(filename),
            mime: detected.mime,
            bytes: bytes.byteLength,
            width: metadata.width,
            height: metadata.height,
            ...(meta?.alt ? { alt: meta.alt } : {}),
            title: safeFilename(filename),
            checksumSha256: checksumSha256(bytes),
            ...(meta?.folder ? { folder: meta.folder } : {}),
            createdBy: userId,
            createdAt: clock.now(),
          });
          await tx.insert(mediaVariants).values(
            generated.map((variant) => ({
              assetId,
              kind: variant.kind,
              storageKey: variant.storageKey,
              width: variant.width,
              height: variant.height,
              bytes: variant.bytes.byteLength,
              mime: variant.mime,
            })),
          );
        });
      } catch (err) {
        await Promise.all(storedKeys.map((key) => storage.delete(key)));
        throw err;
      }

      return this.get(assetId);
    },

    async list(siteId: string, query: MediaQuery): Promise<Paginated<MediaAsset>> {
      const filters = [eq(mediaAssets.siteId, siteId)];
      if (query.mime) filters.push(ilike(mediaAssets.mime, `${query.mime}%`));
      if (query.folder) filters.push(eq(mediaAssets.folder, query.folder));
      if (query.search) {
        filters.push(
          or(ilike(mediaAssets.filename, `%${query.search}%`), ilike(mediaAssets.title, `%${query.search}%`))!,
        );
      }
      const where = and(...filters);
      const total = (
        await db.select({ n: sql<number>`count(*)::int` }).from(mediaAssets).where(where)
      )[0]!.n;
      const rows = await db
        .select()
        .from(mediaAssets)
        .where(where)
        .orderBy(desc(mediaAssets.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      const data = await Promise.all(
        rows.map(async (row) => toAsset(row, await variantsFor(row.id), storage)),
      );
      return { data, page: query.page, pageSize: query.pageSize, total };
    },

    async folders(siteId: string): Promise<MediaFolder[]> {
      const rows = await db
        .select({ name: mediaAssets.folder, count: sql<number>`count(*)::int` })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.siteId, siteId), isNotNull(mediaAssets.folder)))
        .groupBy(mediaAssets.folder)
        .orderBy(mediaAssets.folder);
      return rows
        .filter((row): row is { name: string; count: number } => typeof row.name === "string")
        .map((row) => ({ name: row.name, count: row.count }));
    },

    async update(id: string, patch: UpdateMediaRequest): Promise<MediaAsset> {
      await loadAsset(id); // 404 si no existe
      const set: Partial<AssetRow> = {};
      if (patch.alt !== undefined) set.alt = patch.alt;
      if (patch.title !== undefined) set.title = patch.title;
      if (patch.folder !== undefined) set.folder = patch.folder; // null saca de la carpeta
      if (Object.keys(set).length > 0) await db.update(mediaAssets).set(set).where(eq(mediaAssets.id, id));
      return this.get(id);
    },

    async get(id: string): Promise<MediaAsset> {
      const row = await loadAsset(id);
      return toAsset(row, await variantsFor(id), storage);
    },

    async getForSite(id: string, siteId: string): Promise<MediaAsset> {
      const row = await loadAsset(id, siteId);
      return toAsset(row, await variantsFor(id), storage);
    },

    async remove(id: string): Promise<void> {
      const row = await loadAsset(id);
      const variants = await variantsFor(id);
      await Promise.all([storage.delete(row.storageKey), ...variants.map((variant) => storage.delete(variant.storageKey))]);
      await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
    },

    async file(key: string): Promise<{ bytes: Uint8Array; mime: string }> {
      const asset = (await db.select().from(mediaAssets).where(eq(mediaAssets.storageKey, key)).limit(1))[0];
      if (asset) return { bytes: await storage.get(asset.storageKey), mime: asset.mime };
      const variant = (await db.select().from(mediaVariants).where(eq(mediaVariants.storageKey, key)).limit(1))[0];
      if (!variant) throw notFound("archivo no existe");
      return { bytes: await storage.get(variant.storageKey), mime: variant.mime };
    },
  };
}

export type MediaService = ReturnType<typeof createMediaService>;

import { and, desc, eq, ilike, sql } from "drizzle-orm";
import type {
  CreateEntryRequest,
  Entry,
  EntryRevision,
  EntryStatus,
  EntryStatusCounts,
  ListEntriesQuery,
  Paginated,
  UpdateEntryRequest,
} from "@astrocms/contracts";
import type { BuilderNode } from "@astrocms/contracts";
import { builderDocuments, builderDocumentVersions, contentTypes, entries, entryVersions, users } from "@astrocms/cms-database";
import type { Database } from "@astrocms/cms-database";
import { conflict, notFound } from "./errors.js";
import { assertTransition } from "./entry-transitions.js";
import { toEntry } from "./mappers.js";
import { slugify, type Clock } from "./ports.js";
import type { AuditRecordInput } from "./audit-service.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0] | Database;
type PublishCallback = (siteId: string, data: unknown) => Promise<void>;
type AuditRecorder = (input: AuditRecordInput) => Promise<void>;

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export function createEntryService(
  db: Database,
  clock: Clock,
  onPublished?: PublishCallback,
  recordAudit?: AuditRecorder,
) {
  async function contentTypeByKey(siteId: string, key: string) {
    const row = (
      await db
        .select()
        .from(contentTypes)
        .where(and(eq(contentTypes.siteId, siteId), eq(contentTypes.key, key)))
        .limit(1)
    )[0];
    if (!row) throw notFound(`content type '${key}' no existe`);
    return row;
  }

  async function keyById(id: string): Promise<string> {
    const row = (await db.select().from(contentTypes).where(eq(contentTypes.id, id)).limit(1))[0];
    return row?.key ?? "page";
  }

  async function versionById(id: string | null) {
    if (!id) return undefined;
    return (await db.select().from(entryVersions).where(eq(entryVersions.id, id)).limit(1))[0];
  }

  async function loadContract(entryId: string): Promise<Entry> {
    const row = (
      await db
        .select({ entry: entries, authorName: users.name })
        .from(entries)
        .innerJoin(users, eq(entries.authorId, users.id))
        .where(eq(entries.id, entryId))
        .limit(1)
    )[0];
    const entry = row?.entry;
    if (!entry) throw notFound("entry no existe");
    const current = await versionById(entry.currentVersionId);
    if (!current) throw notFound("versión actual no existe");
    const published = await versionById(entry.publishedVersionId);
    return toEntry({
      entry: { ...entry, authorName: row.authorName },
      version: current,
      contentTypeKey: await keyById(entry.contentTypeId),
      ...(published ? { publishedVersionNo: published.versionNo } : {}),
    });
  }

  async function nextVersionNo(tx: Tx, entryId: string): Promise<number> {
    const row = (
      await tx
        .select({ max: sql<number>`coalesce(max(${entryVersions.versionNo}), 0)` })
        .from(entryVersions)
        .where(eq(entryVersions.entryId, entryId))
    )[0];
    return (row?.max ?? 0) + 1;
  }

  async function createInitialBuilderDocument(tx: Tx, args: { siteId: string; entryId: string; createdBy: string }): Promise<string> {
    const root: BuilderNode = { id: "root", type: "core/page", version: 1, props: {}, children: [] };
    const doc = (
      await tx
        .insert(builderDocuments)
        .values({ siteId: args.siteId, entryId: args.entryId, schemaVersion: 1 })
        .returning({ id: builderDocuments.id })
    )[0]!;
    const version = (
      await tx
        .insert(builderDocumentVersions)
        .values({
          documentId: doc.id,
          versionNo: 1,
          tree: root,
          schemaVersion: 1,
          createdBy: args.createdBy,
          note: "creación",
        })
        .returning({ id: builderDocumentVersions.id })
    )[0]!;
    await tx.update(builderDocuments).set({ currentVersionId: version.id }).where(eq(builderDocuments.id, doc.id));
    return doc.id;
  }

  async function recordAuditSafe(input: AuditRecordInput): Promise<void> {
    try {
      await recordAudit?.(input);
    } catch {
      // La auditoría no debe romper operaciones de contenido.
    }
  }

  /** Deriva un slug único a partir de una base, añadiendo -2, -3… si ya existe (estilo WordPress). */
  async function uniqueSlug(siteId: string, contentTypeId: string, base: string): Promise<string> {
    const root = base && base !== "/" ? base : "/pagina";
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? root : `${root}-${n}`;
      const taken = (
        await db
          .select({ id: entries.id })
          .from(entries)
          .where(and(eq(entries.siteId, siteId), eq(entries.contentTypeId, contentTypeId), eq(entries.slug, candidate)))
          .limit(1)
      )[0];
      if (!taken) return candidate;
    }
  }

  return {
    async create(args: {
      siteId: string;
      authorId: string;
      input: CreateEntryRequest;
    }): Promise<Entry> {
      const ct = await contentTypeByKey(args.siteId, args.input.contentTypeKey);
      // Si el cliente no da slug, se deriva del título y se hace único automáticamente (como WordPress).
      const slug = args.input.slug ?? (await uniqueSlug(args.siteId, ct.id, slugify(args.input.title)));
      try {
        const entryId = await db.transaction(async (tx) => {
          const inserted = (
            await tx
              .insert(entries)
              .values({
                siteId: args.siteId,
                contentTypeId: ct.id,
                slug,
                status: "draft",
                editorType: args.input.editorType,
                authorId: args.authorId,
              })
              .returning({ id: entries.id })
          )[0]!;
          const builderDocumentId = args.input.editorType === "builder"
            ? await createInitialBuilderDocument(tx, { siteId: args.siteId, entryId: inserted.id, createdBy: args.authorId })
            : undefined;
          const version = (
            await tx
              .insert(entryVersions)
              .values({
                entryId: inserted.id,
                versionNo: 1,
                title: args.input.title,
                data: args.input.data ?? {},
                seo: {},
                ...(builderDocumentId ? { builderDocumentId } : {}),
                createdBy: args.authorId,
                note: "creación",
              })
              .returning({ id: entryVersions.id })
          )[0]!;
          await tx
            .update(entries)
            .set({ currentVersionId: version.id })
            .where(eq(entries.id, inserted.id));
          return inserted.id;
        });
        return this.get(entryId);
      } catch (err) {
        if (isUniqueViolation(err)) throw conflict(`slug '${slug}' ya está en uso`);
        throw err;
      }
    },

    get(id: string): Promise<Entry> {
      return loadContract(id);
    },

    async list(args: {
      siteId: string;
      contentTypeKey: string;
      query: ListEntriesQuery;
    }): Promise<Paginated<Entry>> {
      const ct = await contentTypeByKey(args.siteId, args.contentTypeKey);
      const filters = [eq(entries.siteId, args.siteId), eq(entries.contentTypeId, ct.id)];
      if (args.query.status) filters.push(eq(entries.status, args.query.status));
      const search = args.query.search?.trim();
      if (search) filters.push(ilike(entryVersions.title, `%${search}%`));
      const where = and(...filters);
      const total = (
        await db
          .select({ n: sql<number>`count(*)::int` })
          .from(entries)
          .innerJoin(entryVersions, eq(entries.currentVersionId, entryVersions.id))
          .where(where)
      )[0]!.n;
      const rows = await db
        .select({ id: entries.id })
        .from(entries)
        .innerJoin(entryVersions, eq(entries.currentVersionId, entryVersions.id))
        .where(where)
        .orderBy(desc(entries.updatedAt))
        .limit(args.query.pageSize)
        .offset((args.query.page - 1) * args.query.pageSize);
      const data = await Promise.all(rows.map((r) => loadContract(r.id)));
      return { data, page: args.query.page, pageSize: args.query.pageSize, total };
    },

    async statusCounts(args: {
      siteId: string;
      contentTypeKey: string;
    }): Promise<EntryStatusCounts> {
      const ct = await contentTypeByKey(args.siteId, args.contentTypeKey);
      const rows = await db
        .select({ status: entries.status, n: sql<number>`count(*)::int` })
        .from(entries)
        .where(and(eq(entries.siteId, args.siteId), eq(entries.contentTypeId, ct.id)))
        .groupBy(entries.status);
      const counts: Record<EntryStatus, number> = { draft: 0, published: 0, archived: 0 };
      for (const row of rows) counts[row.status] = row.n;
      return {
        all: counts.draft + counts.published + counts.archived,
        draft: counts.draft,
        published: counts.published,
        archived: counts.archived,
      };
    },

    async update(args: {
      id: string;
      userId: string;
      input: UpdateEntryRequest;
    }): Promise<Entry> {
      const entry = (await db.select().from(entries).where(eq(entries.id, args.id)).limit(1))[0];
      if (!entry) throw notFound("entry no existe");
      const current = await versionById(entry.currentVersionId);
      if (!current) throw notFound("versión actual no existe");
      try {
        await db.transaction(async (tx) => {
          const no = await nextVersionNo(tx, entry.id);
          const builderDocumentId =
            args.input.editorType === "builder" && !current.builderDocumentId
              ? await createInitialBuilderDocument(tx, { siteId: entry.siteId, entryId: entry.id, createdBy: args.userId })
              : current.builderDocumentId;
          const version = (
            await tx
              .insert(entryVersions)
              .values({
                entryId: entry.id,
                versionNo: no,
                title: args.input.title ?? current.title,
                data: args.input.data ?? current.data ?? {},
                seo: args.input.seo ?? current.seo ?? {},
                builderDocumentId,
                createdBy: args.userId,
                note: "edición",
              })
              .returning({ id: entryVersions.id })
          )[0]!;
          await tx
            .update(entries)
            .set({
              currentVersionId: version.id,
              ...(args.input.slug ? { slug: args.input.slug } : {}),
              ...(args.input.editorType ? { editorType: args.input.editorType } : {}),
              updatedAt: clock.now(),
            })
            .where(eq(entries.id, entry.id));
        });
        return this.get(entry.id);
      } catch (err) {
        if (isUniqueViolation(err)) throw conflict("slug ya está en uso");
        throw err;
      }
    },

    async publish(args: { id: string; userId?: string }): Promise<Entry> {
      const entry = (await db.select().from(entries).where(eq(entries.id, args.id)).limit(1))[0];
      if (!entry) throw notFound("entry no existe");
      assertTransition(entry.status, "published");
      if (!entry.currentVersionId) throw conflict("sin versión que publicar");
      const before = await loadContract(entry.id);
      await db.transaction(async (tx) => {
        if (entry.editorType === "builder") {
          const currentVersion = (
            await tx
              .select({ builderDocumentId: entryVersions.builderDocumentId })
              .from(entryVersions)
              .where(eq(entryVersions.id, entry.currentVersionId!))
              .limit(1)
          )[0];
          if (currentVersion?.builderDocumentId) {
            const document = (
              await tx
                .select({ currentVersionId: builderDocuments.currentVersionId })
                .from(builderDocuments)
                .where(eq(builderDocuments.id, currentVersion.builderDocumentId))
                .limit(1)
            )[0];
            if (document?.currentVersionId) {
              await tx
                .update(builderDocuments)
                .set({ publishedVersionId: document.currentVersionId, updatedAt: clock.now() })
                .where(eq(builderDocuments.id, currentVersion.builderDocumentId));
            }
          }
        }
        await tx
          .update(entries)
          .set({ status: "published", publishedVersionId: entry.currentVersionId, updatedAt: clock.now() })
          .where(eq(entries.id, args.id));
      });
      const published = await this.get(args.id);
      // Un único webhook entry.published con el Entry completo. Publicar el builder
      // document (mover su puntero) es parte de la MISMA transacción atómica y NO
      // debe emitir un segundo entry.published (payload malformado / entrega duplicada).
      try {
        await onPublished?.(entry.siteId, published);
      } catch {
        // Los webhooks no deben romper la publicación.
      }
      await recordAuditSafe({
        siteId: entry.siteId,
        ...(args.userId ? { actorUserId: args.userId } : {}),
        action: "entry.published",
        entityType: "entry",
        entityId: entry.id,
        before,
        after: published,
      });
      return published;
    },

    async unpublish(args: { id: string; userId?: string }): Promise<Entry> {
      const entry = (await db.select().from(entries).where(eq(entries.id, args.id)).limit(1))[0];
      if (!entry) throw notFound("entry no existe");
      assertTransition(entry.status, "draft");
      const before = await loadContract(entry.id);
      await db
        .update(entries)
        .set({ status: "draft", publishedVersionId: null, updatedAt: clock.now() })
        .where(eq(entries.id, args.id));
      const after = await this.get(args.id);
      await recordAuditSafe({
        siteId: entry.siteId,
        ...(args.userId ? { actorUserId: args.userId } : {}),
        action: "entry.unpublished",
        entityType: "entry",
        entityId: entry.id,
        before,
        after,
      });
      return after;
    },

    async remove(args: { id: string; userId?: string }): Promise<void> {
      const entry = (await db.select().from(entries).where(eq(entries.id, args.id)).limit(1))[0];
      if (!entry) throw notFound("entry no existe");
      const before = await loadContract(entry.id);
      await db.delete(entries).where(eq(entries.id, args.id));
      await recordAuditSafe({
        siteId: entry.siteId,
        ...(args.userId ? { actorUserId: args.userId } : {}),
        action: "entry.deleted",
        entityType: "entry",
        entityId: entry.id,
        before,
        after: null,
      });
    },

    async revisions(id: string): Promise<EntryRevision[]> {
      const entry = (await db.select().from(entries).where(eq(entries.id, id)).limit(1))[0];
      if (!entry) throw notFound("entry no existe");
      const rows = await db
        .select()
        .from(entryVersions)
        .where(eq(entryVersions.entryId, id))
        .orderBy(desc(entryVersions.versionNo));
      return rows.map((v) => ({
        versionNo: v.versionNo,
        title: v.title,
        createdBy: v.createdBy,
        createdAt: v.createdAt.toISOString(),
        ...(v.note ? { note: v.note } : {}),
        isPublished: v.id === entry.publishedVersionId,
      }));
    },

    async restore(args: { id: string; versionNo: number; userId: string }): Promise<Entry> {
      const entry = (await db.select().from(entries).where(eq(entries.id, args.id)).limit(1))[0];
      if (!entry) throw notFound("entry no existe");
      const source = (
        await db
          .select()
          .from(entryVersions)
          .where(and(eq(entryVersions.entryId, args.id), eq(entryVersions.versionNo, args.versionNo)))
          .limit(1)
      )[0];
      if (!source) throw notFound(`revisión ${args.versionNo} no existe`);
      await db.transaction(async (tx) => {
        const no = await nextVersionNo(tx, args.id);
        const version = (
          await tx
            .insert(entryVersions)
            .values({
              entryId: args.id,
              versionNo: no,
              title: source.title,
              data: source.data,
              seo: source.seo,
              builderDocumentId: source.builderDocumentId,
              createdBy: args.userId,
              note: `restaurado de v${args.versionNo}`,
            })
            .returning({ id: entryVersions.id })
        )[0]!;
        await tx
          .update(entries)
          .set({ currentVersionId: version.id, updatedAt: clock.now() })
          .where(eq(entries.id, args.id));
      });
      return this.get(args.id);
    },

    /** API pública: sólo devuelve contenido publicado (usa la versión publicada). */
    async getPublishedBySlug(siteId: string, slug: string): Promise<Entry | null> {
      const entry = (
        await db
          .select()
          .from(entries)
          .where(
            and(
              eq(entries.siteId, siteId),
              eq(entries.slug, slug),
              eq(entries.status, "published"),
            ),
          )
          .limit(1)
      )[0];
      if (!entry || !entry.publishedVersionId) return null;
      const published = await versionById(entry.publishedVersionId);
      if (!published) return null;
      return toEntry({
        entry,
        version: published,
        contentTypeKey: await keyById(entry.contentTypeId),
        publishedVersionNo: published.versionNo,
      });
    },
  };
}

export type EntryService = ReturnType<typeof createEntryService>;

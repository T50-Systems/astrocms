import { and, desc, eq, sql } from "drizzle-orm";
import type { BuilderDocument, BuilderNode, BuilderRevision } from "@astrocms/contracts";
import { builderDocumentVersions, builderDocuments } from "@astrocms/cms-database";
import type { Database } from "@astrocms/cms-database";
import { conflict, notFound } from "./errors.js";
import type { Clock } from "./ports.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0] | Database;
type PublishCallback = (siteId: string, data: unknown) => Promise<void>;

function toDocument(id: string, schemaVersion: number, tree: unknown): BuilderDocument {
  return { id, schemaVersion, root: tree as BuilderNode };
}

export function createBuilderService(db: Database, clock: Clock, onPublished?: PublishCallback) {
  async function currentVersion(docId: string) {
    const doc = (await db.select().from(builderDocuments).where(eq(builderDocuments.id, docId)).limit(1))[0];
    if (!doc) throw notFound("documento del builder no existe");
    if (!doc.currentVersionId) throw notFound("documento sin versión");
    const version = (
      await db.select().from(builderDocumentVersions).where(eq(builderDocumentVersions.id, doc.currentVersionId)).limit(1)
    )[0];
    if (!version) throw notFound("versión actual no existe");
    return { doc, version };
  }

  async function nextNo(tx: Tx, docId: string): Promise<number> {
    const row = (
      await tx
        .select({ max: sql<number>`coalesce(max(${builderDocumentVersions.versionNo}), 0)` })
        .from(builderDocumentVersions)
        .where(eq(builderDocumentVersions.documentId, docId))
    )[0];
    return (row?.max ?? 0) + 1;
  }

  return {
    async create(args: { siteId: string; entryId?: string; root: BuilderNode; createdBy: string }): Promise<BuilderDocument> {
      const id = await db.transaction(async (tx) => {
        const doc = (
          await tx
            .insert(builderDocuments)
            .values({ siteId: args.siteId, entryId: args.entryId ?? null, schemaVersion: 1 })
            .returning({ id: builderDocuments.id })
        )[0]!;
        const version = (
          await tx
            .insert(builderDocumentVersions)
            .values({ documentId: doc.id, versionNo: 1, tree: args.root, schemaVersion: 1, createdBy: args.createdBy, note: "creación" })
            .returning({ id: builderDocumentVersions.id })
        )[0]!;
        await tx.update(builderDocuments).set({ currentVersionId: version.id }).where(eq(builderDocuments.id, doc.id));
        return doc.id;
      });
      return this.get(id);
    },

    async get(id: string): Promise<BuilderDocument> {
      const { version } = await currentVersion(id);
      return toDocument(id, version.schemaVersion, version.tree);
    },

    /** API pública: sólo la versión PUBLICADA del documento (o null). */
    async getPublished(id: string): Promise<BuilderDocument | null> {
      const doc = (await db.select().from(builderDocuments).where(eq(builderDocuments.id, id)).limit(1))[0];
      if (!doc || !doc.publishedVersionId) return null;
      const version = (
        await db.select().from(builderDocumentVersions).where(eq(builderDocumentVersions.id, doc.publishedVersionId)).limit(1)
      )[0];
      if (!version) return null;
      return toDocument(id, version.schemaVersion, version.tree);
    },

    async saveDraft(args: { id: string; document: BuilderDocument; userId: string }): Promise<void> {
      const doc = (await db.select().from(builderDocuments).where(eq(builderDocuments.id, args.id)).limit(1))[0];
      if (!doc) throw notFound("documento del builder no existe");
      await db.transaction(async (tx) => {
        const no = await nextNo(tx, args.id);
        const version = (
          await tx
            .insert(builderDocumentVersions)
            .values({
              documentId: args.id,
              versionNo: no,
              tree: args.document.root,
              schemaVersion: args.document.schemaVersion,
              createdBy: args.userId,
              note: "draft",
            })
            .returning({ id: builderDocumentVersions.id })
        )[0]!;
        await tx
          .update(builderDocuments)
          .set({ currentVersionId: version.id, schemaVersion: args.document.schemaVersion, updatedAt: clock.now() })
          .where(eq(builderDocuments.id, args.id));
      });
    },

    async publish(id: string): Promise<void> {
      const { doc } = await currentVersion(id);
      await db
        .update(builderDocuments)
        .set({ publishedVersionId: doc.currentVersionId, updatedAt: clock.now() })
        .where(eq(builderDocuments.id, id));
      try {
        await onPublished?.(doc.siteId, { builderDocumentId: id, entryId: doc.entryId });
      } catch {
        // Los webhooks no deben romper la publicación.
      }
    },

    async revisions(id: string): Promise<BuilderRevision[]> {
      const doc = (await db.select().from(builderDocuments).where(eq(builderDocuments.id, id)).limit(1))[0];
      if (!doc) throw notFound("documento del builder no existe");
      const rows = await db
        .select()
        .from(builderDocumentVersions)
        .where(eq(builderDocumentVersions.documentId, id))
        .orderBy(desc(builderDocumentVersions.versionNo));
      return rows.map((v) => ({
        id: String(v.versionNo),
        createdAt: v.createdAt.toISOString(),
        createdBy: v.createdBy ?? "system",
        ...(v.note ? { note: v.note } : {}),
        isPublished: v.id === doc.publishedVersionId,
      }));
    },

    async restore(args: { id: string; revisionId: string; userId: string }): Promise<BuilderDocument> {
      const versionNo = Number(args.revisionId);
      if (!Number.isInteger(versionNo)) throw conflict("revisionId inválido");
      const source = (
        await db
          .select()
          .from(builderDocumentVersions)
          .where(and(eq(builderDocumentVersions.documentId, args.id), eq(builderDocumentVersions.versionNo, versionNo)))
          .limit(1)
      )[0];
      if (!source) throw notFound(`revisión ${args.revisionId} no existe`);
      await db.transaction(async (tx) => {
        const no = await nextNo(tx, args.id);
        const version = (
          await tx
            .insert(builderDocumentVersions)
            .values({
              documentId: args.id,
              versionNo: no,
              tree: source.tree,
              schemaVersion: source.schemaVersion,
              createdBy: args.userId,
              note: `restaurado de v${args.revisionId}`,
            })
            .returning({ id: builderDocumentVersions.id })
        )[0]!;
        await tx.update(builderDocuments).set({ currentVersionId: version.id, updatedAt: clock.now() }).where(eq(builderDocuments.id, args.id));
      });
      return this.get(args.id);
    },
  };
}

export type BuilderService = ReturnType<typeof createBuilderService>;

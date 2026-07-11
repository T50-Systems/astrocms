import type { Entry, EntryStatus, EditorType, SeoMeta } from "@astrocms/contracts";

export interface EntryRow {
  id: string;
  slug: string;
  status: EntryStatus;
  editorType: EditorType;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VersionRow {
  versionNo: number;
  title: string;
  data: unknown;
  seo: unknown;
  builderDocumentId: string | null;
}

/** Compone un `Entry` de contrato a partir de la fila de entry + una versión concreta. */
export function toEntry(args: {
  entry: EntryRow;
  version: VersionRow;
  contentTypeKey: string;
  publishedVersionNo?: number;
}): Entry {
  const { entry, version, contentTypeKey, publishedVersionNo } = args;
  return {
    id: entry.id,
    contentTypeKey,
    title: version.title,
    slug: entry.slug,
    status: entry.status,
    editorType: entry.editorType,
    data: (version.data ?? {}) as Record<string, unknown>,
    seo: (version.seo ?? {}) as SeoMeta,
    ...(version.builderDocumentId ? { builderDocumentId: version.builderDocumentId } : {}),
    currentVersionNo: version.versionNo,
    ...(publishedVersionNo ? { publishedVersionNo } : {}),
    authorId: entry.authorId,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

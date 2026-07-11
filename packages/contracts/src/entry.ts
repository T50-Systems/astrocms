import { z } from "zod";
import {
  editorTypeSchema,
  entryStatusSchema,
  idSchema,
  isoDateTimeSchema,
} from "./common.js";

/** Slug: '/', '/acerca', '/blog/hola-mundo'. Empieza por '/', sin espacios. */
export const slugSchema = z
  .string()
  .regex(/^\/[a-z0-9\-/]*$/i, "slug inválido: debe empezar por '/' y usar [a-z0-9-/]");

export const seoMetaSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  canonical: z.string().url().optional(),
  noindex: z.boolean().optional(),
  ogImageAssetId: idSchema.optional(),
  extra: z.record(z.string()).optional(),
});
export type SeoMeta = z.infer<typeof seoMetaSchema>;

export const entrySchema = z.object({
  id: idSchema,
  contentTypeKey: z.string(),
  title: z.string(),
  slug: slugSchema,
  status: entryStatusSchema,
  editorType: editorTypeSchema,
  data: z.record(z.unknown()),
  seo: seoMetaSchema,
  builderDocumentId: idSchema.optional(),
  currentVersionNo: z.number().int().positive(),
  publishedVersionNo: z.number().int().positive().optional(),
  authorId: idSchema,
  authorName: z.string().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Entry = z.infer<typeof entrySchema>;

export const entryStatusCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  draft: z.number().int().nonnegative(),
  published: z.number().int().nonnegative(),
  archived: z.number().int().nonnegative(),
});
export type EntryStatusCounts = z.infer<typeof entryStatusCountsSchema>;

export const createEntryRequestSchema = z.object({
  contentTypeKey: z.string().default("page"),
  title: z.string().min(1),
  slug: slugSchema.optional(),
  editorType: editorTypeSchema.default("rich-text"),
  data: z.record(z.unknown()).optional(),
});
export type CreateEntryRequest = z.infer<typeof createEntryRequestSchema>;

export const updateEntryRequestSchema = z
  .object({
    title: z.string().min(1),
    slug: slugSchema,
    data: z.record(z.unknown()),
    seo: seoMetaSchema,
    editorType: editorTypeSchema,
  })
  .partial();
export type UpdateEntryRequest = z.infer<typeof updateEntryRequestSchema>;

export const entryRevisionSchema = z.object({
  versionNo: z.number().int().positive(),
  title: z.string(),
  createdBy: idSchema,
  createdAt: isoDateTimeSchema,
  note: z.string().optional(),
  isPublished: z.boolean(),
});
export type EntryRevision = z.infer<typeof entryRevisionSchema>;

export const listEntriesQuerySchema = z.object({
  status: entryStatusSchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>;

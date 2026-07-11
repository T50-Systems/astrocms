import { z } from "zod";
import { idSchema, isoDateTimeSchema, paginatedSchema } from "./common.js";

export const mediaVariantSchema = z.object({
  kind: z.string().min(1),
  url: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type MediaVariant = z.infer<typeof mediaVariantSchema>;

export const mediaAssetSchema = z.object({
  id: idSchema,
  filename: z.string().min(1),
  mime: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().optional(),
  title: z.string().optional(),
  url: z.string().min(1),
  variants: z.array(mediaVariantSchema),
  createdAt: isoDateTimeSchema,
});
export type MediaAsset = z.infer<typeof mediaAssetSchema>;

export const mediaQuerySchema = z.object({
  search: z.string().min(1).optional(),
  mime: z.string().min(1).optional(),
  folder: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type MediaQuery = z.infer<typeof mediaQuerySchema>;

export const paginatedMediaAssetSchema = paginatedSchema(mediaAssetSchema);

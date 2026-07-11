import { z } from "zod";

/** Versión de la API REST. */
export const API_VERSION = "v1" as const;

export const idSchema = z.string().min(1);
export type ID = z.infer<typeof idSchema>;

/** ISO-8601, p.ej. '2026-07-10T12:00:00.000Z'. */
export const isoDateTimeSchema = z.string().datetime();
export type ISODateTime = z.infer<typeof isoDateTimeSchema>;

export const editorTypeSchema = z.enum(["rich-text", "markdown", "builder"]);
export type EditorType = z.infer<typeof editorTypeSchema>;

export const entryStatusSchema = z.enum(["draft", "published", "archived"]);
export type EntryStatus = z.infer<typeof entryStatusSchema>;

/** Envoltorio de paginación. */
export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  });
}
export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Forma canónica de error de la API. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** Códigos de error estables usados por servidor y SDK. */
export const ErrorCode = {
  Unauthorized: "unauthorized",
  Forbidden: "forbidden",
  NotFound: "not_found",
  Validation: "validation_error",
  Conflict: "conflict",
  RateLimited: "rate_limited",
  Internal: "internal_error",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

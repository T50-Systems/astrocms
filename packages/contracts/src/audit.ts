import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common.js";

export const auditLogEntrySchema = z.object({
  id: idSchema,
  siteId: idSchema,
  actorUserId: idSchema.nullable(),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  ip: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  entityType: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
});
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;

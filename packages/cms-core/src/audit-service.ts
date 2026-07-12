import { and, desc, eq, sql } from "drizzle-orm";
import type { AuditLogEntry, ListAuditQuery, Paginated } from "@astrocms/contracts";
import { auditLog } from "@astrocms/cms-database";
import type { Database } from "@astrocms/cms-database";
import type { Clock } from "./ports.js";

export interface AuditRecordInput {
  siteId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

function toAuditLogEntry(row: typeof auditLog.$inferSelect): AuditLogEntry {
  return {
    id: row.id,
    siteId: row.siteId,
    actorUserId: row.actorUserId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    before: row.before,
    after: row.after,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createAuditService(db: Database, clock: Clock) {
  return {
    async record(input: AuditRecordInput): Promise<void> {
      await db.insert(auditLog).values({
        siteId: input.siteId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before ?? null,
        after: input.after ?? null,
        ip: input.ip ?? null,
        createdAt: clock.now(),
      });
    },

    async list(args: { siteId: string; query: ListAuditQuery }): Promise<Paginated<AuditLogEntry>> {
      const filters = [eq(auditLog.siteId, args.siteId)];
      if (args.query.entityType) filters.push(eq(auditLog.entityType, args.query.entityType));
      if (args.query.entityId) filters.push(eq(auditLog.entityId, args.query.entityId));
      const where = and(...filters);
      const total = (await db.select({ n: sql<number>`count(*)::int` }).from(auditLog).where(where))[0]!.n;
      const rows = await db
        .select()
        .from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.createdAt))
        .limit(args.query.pageSize)
        .offset((args.query.page - 1) * args.query.pageSize);
      return { data: rows.map(toAuditLogEntry), page: args.query.page, pageSize: args.query.pageSize, total };
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;

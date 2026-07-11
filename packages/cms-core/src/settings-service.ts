import { and, eq } from "drizzle-orm";
import type { SettingsGroup } from "@astrocms/contracts";
import { settings } from "@astrocms/cms-database";
import type { Database } from "@astrocms/cms-database";
import type { Clock } from "./ports.js";

export function createSettingsService(db: Database, clock: Clock) {
  return {
    async getGroup(siteId: string, group: string): Promise<SettingsGroup> {
      const rows = await db
        .select()
        .from(settings)
        .where(and(eq(settings.siteId, siteId), eq(settings.group, group)));
      return {
        group,
        values: Object.fromEntries(rows.map((row) => [row.key, row.value])),
      };
    },

    async setGroup(siteId: string, group: string, values: Record<string, unknown>): Promise<SettingsGroup> {
      await db.transaction(async (tx) => {
        await tx.delete(settings).where(and(eq(settings.siteId, siteId), eq(settings.group, group)));
        const rows = Object.entries(values).map(([key, value]) => ({
          siteId,
          group,
          key,
          value,
          updatedAt: clock.now(),
        }));
        if (rows.length > 0) await tx.insert(settings).values(rows);
      });
      return this.getGroup(siteId, group);
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;

import { sites } from "@astrocms/cms-database";
import type { Database } from "@astrocms/cms-database";
import { createAuthService } from "./auth-service.js";
import { createAuditService } from "./audit-service.js";
import { createBuilderService } from "./builder-service.js";
import { createEntryService } from "./entry-service.js";
import { createMediaService } from "./media-service.js";
import { createMenuService } from "./menu-service.js";
import { createSettingsService } from "./settings-service.js";
import { createWebhookService } from "./webhook-service.js";
import { systemClock, type Clock } from "./ports.js";
import { notFound } from "./errors.js";
import type { StorageDriver } from "@astrocms/storage";

export * from "./errors.js";
export * from "./ports.js";
export * from "./entry-transitions.js";
export type { AuthService, LoginResult } from "./auth-service.js";
export type { AuditService } from "./audit-service.js";
export type { EntryService } from "./entry-service.js";
export type { BuilderService } from "./builder-service.js";
export type { MediaService } from "./media-service.js";
export type { MenuService } from "./menu-service.js";
export type { SettingsService } from "./settings-service.js";
export type { WebhookService } from "./webhook-service.js";

/** Composition del núcleo. El borde (cms-server) inyecta `db` y opcionalmente `clock`. */
export function createCmsCore(opts: { db: Database; storage?: StorageDriver; clock?: Clock }) {
  const clock = opts.clock ?? systemClock;
  const audit = createAuditService(opts.db, clock);
  const webhooks = createWebhookService(opts.db, clock);
  const dispatchPublished = (siteId: string, data: unknown) => webhooks.dispatch("entry.published", siteId, data);
  return {
    auth: createAuthService(opts.db, clock, (input) => audit.record(input)),
    audit,
    entries: createEntryService(opts.db, clock, dispatchPublished, (input) => audit.record(input)),
    builder: createBuilderService(opts.db, clock, dispatchPublished),
    menus: createMenuService(opts.db, clock),
    settings: createSettingsService(opts.db, clock),
    webhooks,
    ...(opts.storage ? { media: createMediaService(opts.db, opts.storage, clock) } : {}),
    async resolvePrimarySiteId(): Promise<string> {
      const row = (await opts.db.select().from(sites).limit(1))[0];
      if (!row) throw notFound("no hay site; ejecuta el seed");
      return row.id;
    },
  };
}

export type CmsCore = ReturnType<typeof createCmsCore>;

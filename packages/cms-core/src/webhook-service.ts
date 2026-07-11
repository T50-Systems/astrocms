import { createHmac } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { CreateWebhookRequest, Webhook, WebhookEvent } from "@astrocms/contracts";
import { webhookDeliveries, webhooks } from "@astrocms/cms-database";
import type { Database } from "@astrocms/cms-database";
import { notFound } from "./errors.js";
import type { Clock } from "./ports.js";

type WebhookRow = typeof webhooks.$inferSelect;

function toWebhook(row: WebhookRow): Webhook {
  return {
    id: row.id,
    event: row.event,
    targetUrl: row.targetUrl,
    active: row.active,
  };
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function createWebhookService(db: Database, clock: Clock) {
  async function recordDelivery(args: {
    webhookId: string;
    event: WebhookEvent;
    payload: Record<string, unknown>;
    statusCode?: number;
    error?: string;
  }): Promise<void> {
    await db.insert(webhookDeliveries).values({
      webhookId: args.webhookId,
      event: args.event,
      payload: args.payload,
      ...(args.statusCode !== undefined ? { statusCode: args.statusCode } : {}),
      ...(args.error ? { error: args.error } : {}),
      attempt: 1,
      deliveredAt: clock.now(),
    });
  }

  return {
    async list(siteId: string): Promise<Webhook[]> {
      const rows = await db.select().from(webhooks).where(eq(webhooks.siteId, siteId)).orderBy(desc(webhooks.createdAt));
      return rows.map(toWebhook);
    },

    async register(siteId: string, input: CreateWebhookRequest): Promise<Webhook> {
      const row = (
        await db
          .insert(webhooks)
          .values({
            siteId,
            event: input.event,
            targetUrl: input.targetUrl,
            secret: input.secret,
            active: input.active ?? true,
          })
          .returning()
      )[0]!;
      return toWebhook(row);
    },

    async remove(siteId: string, id: string): Promise<void> {
      const row = (
        await db.select().from(webhooks).where(and(eq(webhooks.siteId, siteId), eq(webhooks.id, id))).limit(1)
      )[0];
      if (!row) throw notFound("webhook no existe");
      await db.delete(webhooks).where(eq(webhooks.id, id));
    },

    async dispatch(event: WebhookEvent, siteId: string, data: unknown): Promise<void> {
      const rows = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.siteId, siteId), eq(webhooks.event, event), eq(webhooks.active, true)));
      await Promise.all(
        rows.map(async (hook) => {
          const deliveredAt = clock.now().toISOString();
          const bodyPayload = { event, siteId, data, deliveredAt };
          const body = JSON.stringify(bodyPayload);
          const signature = sign(body, hook.secret);
          const storedPayload = { ...bodyPayload, signature };
          try {
            const res = await fetch(hook.targetUrl, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-astrocms-event": event,
                "x-astrocms-signature": signature,
              },
              body,
            });
            const errorText = res.ok ? undefined : await res.text().catch(() => res.statusText);
            await recordDelivery({
              webhookId: hook.id,
              event,
              payload: storedPayload,
              statusCode: res.status,
              ...(errorText ? { error: errorText } : {}),
            });
          } catch (err) {
            await recordDelivery({
              webhookId: hook.id,
              event,
              payload: storedPayload,
              error: err instanceof Error ? err.message : "webhook dispatch failed",
            });
          }
        }),
      );
    },
  };
}

export type WebhookService = ReturnType<typeof createWebhookService>;

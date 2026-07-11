import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common.js";

export const webhookEventSchema = z.string().min(1);
export type WebhookEvent =
  | "entry.published"
  | "entry.unpublished"
  | "entry.deleted"
  | "media.created"
  | "media.deleted"
  | (string & {});

export const webhookSchema = z.object({
  id: idSchema,
  event: webhookEventSchema,
  targetUrl: z.string().url(),
  active: z.boolean(),
});
export type Webhook = z.infer<typeof webhookSchema> & { event: WebhookEvent };

export const createWebhookRequestSchema = z.object({
  event: webhookEventSchema,
  targetUrl: z.string().url(),
  secret: z.string().min(1),
  active: z.boolean().optional(),
});
export type CreateWebhookRequest = z.infer<typeof createWebhookRequestSchema> & { event: WebhookEvent };

export const webhookPayloadSchema = z.object({
  event: webhookEventSchema,
  siteId: idSchema,
  data: z.unknown(),
  deliveredAt: isoDateTimeSchema,
  signature: z.string(),
});
export type WebhookPayload<T = unknown> = Omit<z.infer<typeof webhookPayloadSchema>, "data" | "event"> & {
  event: WebhookEvent;
  data: T;
};

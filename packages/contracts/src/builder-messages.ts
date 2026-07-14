import { z } from "zod";
import { builderDocumentSchema } from "./builder.js";

/** Protocolo postMessage host(panel) ⇄ guest(preview Astro). Validado con Zod en ambos lados. */
export const PROTOCOL_VERSION = 1 as const;

export const hostMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("host/ready"), manifestVersion: z.number().int(), blockVersions: z.record(z.number().int()) }),
  z.object({ type: z.literal("host/document-updated"), document: builderDocumentSchema, renderToken: z.number().int() }),
  z.object({ type: z.literal("host/node-props-updated"), nodeId: z.string(), props: z.record(z.unknown()) }),
  z.object({ type: z.literal("host/select-node"), nodeId: z.string().nullable() }),
  z.object({ type: z.literal("host/hover-node"), nodeId: z.string().nullable() }),
  z.object({ type: z.literal("host/request-scroll-to-node"), nodeId: z.string() }),
  z.object({ type: z.literal("host/set-breakpoint"), breakpoint: z.string() }),
  z.object({ type: z.literal("host/reload-preview") }),
]);
export type HostMessage = z.infer<typeof hostMessageSchema>;

export const guestMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("guest/preview-ready"), documentId: z.string(), renderedNodeIds: z.array(z.string()) }),
  z.object({ type: z.literal("guest/node-selected"), nodeId: z.string() }),
  z.object({ type: z.literal("guest/node-hovered"), nodeId: z.string().nullable() }),
  z.object({ type: z.literal("guest/inline-edit"), nodeId: z.string(), path: z.string(), value: z.string() }),
  z.object({ type: z.literal("guest/request-insert-node"), parentId: z.string(), index: z.number().int(), blockType: z.string() }),
  z.object({ type: z.literal("guest/preview-error"), nodeId: z.string().optional(), message: z.string(), renderToken: z.number().int() }),
  z.object({ type: z.literal("guest/schema-mismatch"), nodeId: z.string(), blockType: z.string(), expected: z.number().int(), found: z.number().int(), renderToken: z.number().int() }),
]);
export type GuestMessage = z.infer<typeof guestMessageSchema>;

export const builderMessageSchema = z.union([hostMessageSchema, guestMessageSchema]);
export type BuilderMessage = HostMessage | GuestMessage;

export const envelopeSchema = z.object({
  protocol: z.literal(PROTOCOL_VERSION),
  channelId: z.string().min(1),
  source: z.enum(["host", "guest"]),
  message: builderMessageSchema,
});
export type Envelope = z.infer<typeof envelopeSchema>;

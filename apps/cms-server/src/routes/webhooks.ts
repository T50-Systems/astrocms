import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createWebhookRequestSchema } from "@astrocms/contracts";
import { makeGuards } from "../guards.js";
import { parse, sendError } from "../http.js";

const idParam = z.object({ id: z.string().min(1) });

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  const { requireAuth, requirePermission } = makeGuards(app);
  const manage = { preHandler: [requireAuth, requirePermission("webhooks.manage")] };

  app.get("/webhooks", manage, async (_req, reply) => {
    try {
      return reply.send(await app.core.webhooks.list(app.siteId));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/webhooks", manage, async (req, reply) => {
    try {
      const input = parse(createWebhookRequestSchema, req.body);
      return reply.code(201).send(await app.core.webhooks.register(app.siteId, input));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.delete("/webhooks/:id", manage, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      await app.core.webhooks.remove(app.siteId, id);
      return reply.code(204).send();
    } catch (err) {
      return sendError(reply, err);
    }
  });
}

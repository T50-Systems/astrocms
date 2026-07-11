import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { setSettingsGroupRequestSchema } from "@astrocms/contracts";
import { makeGuards } from "../guards.js";
import { parse, sendError } from "../http.js";

const groupParam = z.object({ group: z.string().min(1) });

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  const { requireAuth, requirePermission } = makeGuards(app);
  const write = { preHandler: [requireAuth, requirePermission("settings.write")] };

  app.get("/settings/:group", write, async (req, reply) => {
    try {
      const { group } = parse(groupParam, req.params);
      return reply.send(await app.core.settings.getGroup(app.siteId, group));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put("/settings/:group", write, async (req, reply) => {
    try {
      const { group } = parse(groupParam, req.params);
      const body = parse(setSettingsGroupRequestSchema, req.body);
      return reply.send(await app.core.settings.setGroup(app.siteId, group, body.values));
    } catch (err) {
      return sendError(reply, err);
    }
  });
}

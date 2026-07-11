import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { upsertMenuRequestSchema } from "@astrocms/contracts";
import { makeGuards } from "../guards.js";
import { parse, sendError } from "../http.js";

const locationParam = z.object({ location: z.string().min(1) });

export async function menuRoutes(app: FastifyInstance): Promise<void> {
  const { requireAuth, requirePermission } = makeGuards(app);
  const write = { preHandler: [requireAuth, requirePermission("menus.write")] };

  app.get("/menus", write, async (_req, reply) => {
    try {
      return reply.send(await app.core.menus.list(app.siteId));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/menus/:location", write, async (req, reply) => {
    try {
      const { location } = parse(locationParam, req.params);
      return reply.send(await app.core.menus.getByLocation(app.siteId, location));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put("/menus/:location", write, async (req, reply) => {
    try {
      const { location } = parse(locationParam, req.params);
      const input = parse(upsertMenuRequestSchema, req.body);
      return reply.send(await app.core.menus.upsert(app.siteId, location, input));
    } catch (err) {
      return sendError(reply, err);
    }
  });
}

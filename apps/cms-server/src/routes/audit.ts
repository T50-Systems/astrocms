import type { FastifyInstance } from "fastify";
import { listAuditQuerySchema } from "@astrocms/contracts";
import { makeGuards } from "../guards.js";
import { parse, sendError } from "../http.js";

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  const { requireAuth, requirePermission } = makeGuards(app);
  const manageUsers = { preHandler: [requireAuth, requirePermission("users.manage")] };

  app.get("/audit", manageUsers, async (req, reply) => {
    try {
      const query = parse(listAuditQuerySchema, req.query);
      return reply.send(await app.core.audit.list({ siteId: app.siteId, query }));
    } catch (err) {
      return sendError(reply, err);
    }
  });
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createEntryRequestSchema,
  listEntriesQuerySchema,
  updateEntryRequestSchema,
} from "@astrocms/contracts";
import { makeGuards } from "../guards.js";
import { parse, sendError } from "../http.js";

const idParam = z.object({ id: z.string().min(1) });
const restoreParam = z.object({ id: z.string().min(1), versionNo: z.coerce.number().int().positive() });

/** API administrativa de páginas (content type 'page'). Requiere sesión + permisos. */
export async function pageRoutes(app: FastifyInstance): Promise<void> {
  const { requireAuth, requirePermission } = makeGuards(app);
  const CT = "page";
  const read = { preHandler: [requireAuth, requirePermission("pages.read")] };
  const write = { preHandler: [requireAuth, requirePermission("pages.write")] };
  const publish = { preHandler: [requireAuth, requirePermission("pages.publish")] };

  app.get("/pages", read, async (req, reply) => {
    try {
      const query = parse(listEntriesQuerySchema, req.query);
      const result = await app.core.entries.list({ siteId: app.siteId, contentTypeKey: CT, query });
      return reply.send(result);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/pages", write, async (req, reply) => {
    try {
      const input = parse(createEntryRequestSchema, { ...(req.body as object), contentTypeKey: CT });
      const entry = await app.core.entries.create({
        siteId: app.siteId,
        authorId: req.session!.user.id,
        input,
      });
      return reply.code(201).send(entry);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/pages/:id", read, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      return reply.send(await app.core.entries.get(id));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.patch("/pages/:id", write, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      const input = parse(updateEntryRequestSchema, req.body);
      const entry = await app.core.entries.update({ id, userId: req.session!.user.id, input });
      return reply.send(entry);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/pages/:id/publish", publish, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      return reply.send(await app.core.entries.publish(id));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/pages/:id/unpublish", publish, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      return reply.send(await app.core.entries.unpublish(id));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/pages/:id/revisions", read, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      return reply.send(await app.core.entries.revisions(id));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/pages/:id/restore/:versionNo", write, async (req, reply) => {
    try {
      const { id, versionNo } = parse(restoreParam, req.params);
      const entry = await app.core.entries.restore({ id, versionNo, userId: req.session!.user.id });
      return reply.send(entry);
    } catch (err) {
      return sendError(reply, err);
    }
  });
}

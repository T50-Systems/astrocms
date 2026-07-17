import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { builderDocumentSchema, builderNodeSchema } from "@astrocms/contracts";
import { demoBuilderManifest } from "../builder-manifest.js";
import { migrateTree } from "../builder-migrations.js";
import { makeGuards } from "../guards.js";
import { parse, sendError } from "../http.js";

const idParam = z.object({ id: z.string().min(1) });
const restoreParam = z.object({ id: z.string().min(1), revisionId: z.string().min(1) });
const createBody = z.object({ entryId: z.string().optional(), root: builderNodeSchema });

/** API interna del builder: documentos JSON versionados. Requiere sesión + permisos de páginas. */
export async function builderRoutes(app: FastifyInstance): Promise<void> {
  const { requireAuth, requirePermission } = makeGuards(app);
  const read = { preHandler: [requireAuth, requirePermission("pages.read")] };
  const write = { preHandler: [requireAuth, requirePermission("pages.write")] };
  const publish = { preHandler: [requireAuth, requirePermission("pages.publish")] };

  app.get("/builder/manifest", read, async (_req, reply) => reply.send(demoBuilderManifest));

  app.post("/builder/documents", write, async (req, reply) => {
    try {
      const body = parse(createBody, req.body);
      const doc = await app.core.builder.create({
        siteId: app.siteId,
        ...(body.entryId ? { entryId: body.entryId } : {}),
        root: body.root,
        createdBy: req.session!.user.id,
      });
      return reply.code(201).send(doc);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/builder/documents/:id", read, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      return reply.send(migrateTree(await app.core.builder.get(id)));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put("/builder/documents/:id", write, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      const document = parse(builderDocumentSchema, req.body);
      await app.core.builder.saveDraft({ id, document, userId: req.session!.user.id });
      return reply.code(204).send();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/builder/documents/:id/publish", publish, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      await app.core.builder.publish(id);
      return reply.code(204).send();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/builder/documents/:id/revisions", read, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      return reply.send(await app.core.builder.revisions(id));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/builder/documents/:id/restore/:revisionId", write, async (req, reply) => {
    try {
      const { id, revisionId } = parse(restoreParam, req.params);
      const doc = await app.core.builder.restore({ id, revisionId, userId: req.session!.user.id });
      return reply.send(doc);
    } catch (err) {
      return sendError(reply, err);
    }
  });
}

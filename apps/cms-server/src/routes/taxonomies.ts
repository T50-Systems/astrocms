import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { setEntryTermsRequestSchema, upsertTermRequestSchema } from "@astrocms/contracts";
import { makeGuards } from "../guards.js";
import { parse, sendError } from "../http.js";

const keyParam = z.object({ key: z.string().min(1) });
const idParam = z.object({ id: z.string().min(1) });

export async function taxonomyRoutes(app: FastifyInstance): Promise<void> {
  const { requireAuth, requirePermission } = makeGuards(app);
  const read = { preHandler: [requireAuth, requirePermission("pages.read")] };
  const taxonomyWrite = { preHandler: [requireAuth, requirePermission("taxonomy.write")] };
  const pagesWrite = { preHandler: [requireAuth, requirePermission("pages.write")] };

  app.get("/taxonomies", read, async (_req, reply) => {
    try {
      return reply.send(await app.core.taxonomies.listTaxonomies(app.siteId));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/taxonomies/:key", read, async (req, reply) => {
    try {
      const { key } = parse(keyParam, req.params);
      const taxonomy = await app.core.taxonomies.getTaxonomy(app.siteId, key);
      const terms = await app.core.taxonomies.listTerms(taxonomy.id);
      return reply.send({ ...taxonomy, terms });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/taxonomies/:key/terms", taxonomyWrite, async (req, reply) => {
    try {
      const { key } = parse(keyParam, req.params);
      const input = parse(upsertTermRequestSchema, req.body);
      const taxonomy = await app.core.taxonomies.getTaxonomy(app.siteId, key);
      const term = await app.core.taxonomies.upsertTerm({ taxonomyId: taxonomy.id, ...input });
      return reply.code(201).send(term);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/entries/:id/terms", read, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      return reply.send(await app.core.taxonomies.termsForEntry(id));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put("/entries/:id/terms", pagesWrite, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      const { termIds } = parse(setEntryTermsRequestSchema, req.body);
      return reply.send(await app.core.taxonomies.assignTerms(id, termIds));
    } catch (err) {
      return sendError(reply, err);
    }
  });
}

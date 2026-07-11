import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ErrorCode } from "@astrocms/contracts";
import { apiError, parse, sendError } from "../http.js";

const slugQuery = z.object({ slug: z.string().min(1) });
const locationParam = z.object({ location: z.string().min(1) });
const groupParam = z.object({ group: z.string().min(1) });

/**
 * API pública: sólo contenido PUBLICADO, sin autenticación.
 * Nunca devuelve drafts (test negativo en la suite de integración).
 */
export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get("/public/pages", async (req, reply) => {
    try {
      const { slug } = parse(slugQuery, req.query);
      const entry = await app.core.entries.getPublishedBySlug(app.siteId, slug);
      if (!entry) {
        return reply.code(404).send(apiError(ErrorCode.NotFound, "Página no encontrada"));
      }
      return reply.send(entry);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/public/menus/:location", async (req, reply) => {
    try {
      const { location } = parse(locationParam, req.params);
      return reply.send(await app.core.menus.getByLocation(app.siteId, location));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/public/settings/:group", async (req, reply) => {
    try {
      const { group } = parse(groupParam, req.params);
      return reply.send(await app.core.settings.getGroup(app.siteId, group));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  const idParam = z.object({ id: z.string().min(1) });
  app.get("/public/builder/documents/:id", async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      const doc = await app.core.builder.getPublished(id);
      if (!doc) return reply.code(404).send(apiError(ErrorCode.NotFound, "Documento no publicado"));
      return reply.send(doc);
    } catch (err) {
      return sendError(reply, err);
    }
  });
}

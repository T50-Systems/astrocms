import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { mediaQuerySchema, updateMediaRequestSchema } from "@astrocms/contracts";
import { validation } from "@astrocms/cms-core";
import { makeGuards } from "../guards.js";
import { parse, sendError } from "../http.js";

const idParam = z.object({ id: z.string().min(1) });
const keyParam = z.object({ key: z.string().min(1) });

/** API administrativa de biblioteca de medios. */
export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  const { requireAuth, requirePermission } = makeGuards(app);
  const read = { preHandler: [requireAuth, requirePermission("media.read")] };
  const write = { preHandler: [requireAuth, requirePermission("media.write")] };
  const remove = { preHandler: [requireAuth, requirePermission("media.delete")] };

  app.post("/media", write, async (req, reply) => {
    try {
      const media = app.core.media;
      if (!media) throw validation("media no configurado");

      // @fastify/multipart: consume el stream (un solo fichero + campos alt/folder).
      let bytes: Buffer | undefined;
      let filename = "upload";
      let mimetype = "application/octet-stream";
      const fields: Record<string, string> = {};
      for await (const part of req.parts()) {
        if (part.type === "file") {
          filename = part.filename;
          mimetype = part.mimetype;
          bytes = await part.toBuffer();
        } else if (typeof part.value === "string") {
          fields[part.fieldname] = part.value;
        }
      }
      if (!bytes) throw validation("archivo requerido");

      const asset = await media.upload(bytes, filename, mimetype, req.session!.user.id, app.siteId, {
        ...(fields.alt ? { alt: fields.alt } : {}),
        ...(fields.folder ? { folder: fields.folder } : {}),
      });
      return reply.code(201).send(asset);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/media", read, async (req, reply) => {
    try {
      const media = app.core.media;
      if (!media) throw validation("media no configurado");
      const query = parse(mediaQuerySchema, req.query);
      return reply.send(await media.list(app.siteId, query));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/media/folders", read, async (_req, reply) => {
    try {
      const media = app.core.media;
      if (!media) throw validation("media no configurado");
      return reply.send(await media.folders(app.siteId));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/media/:id", read, async (req, reply) => {
    try {
      const media = app.core.media;
      if (!media) throw validation("media no configurado");
      const { id } = parse(idParam, req.params);
      return reply.send(await media.get(id));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.patch("/media/:id", write, async (req, reply) => {
    try {
      const media = app.core.media;
      if (!media) throw validation("media no configurado");
      const { id } = parse(idParam, req.params);
      const patch = parse(updateMediaRequestSchema, req.body);
      return reply.send(await media.update(id, patch));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.delete("/media/:id", remove, async (req, reply) => {
    try {
      const media = app.core.media;
      if (!media) throw validation("media no configurado");
      const { id } = parse(idParam, req.params);
      await media.remove(id);
      return reply.code(204).send();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // Servido de ficheros PÚBLICO (clave opaca): las imágenes de páginas publicadas deben
  // cargar sin sesión. URLs firmadas / media privada quedan para endurecimiento (Fase 7).
  app.get("/media/file/:key", async (req, reply) => {
    try {
      const media = app.core.media;
      if (!media) throw validation("media no configurado");
      const { key } = parse(keyParam, req.params);
      const file = await media.file(key);
      return reply.type(file.mime).send(Buffer.from(file.bytes));
    } catch (err) {
      return sendError(reply, err);
    }
  });
}

import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ErrorCode } from "@astrocms/contracts";
import { makeGuards } from "../guards.js";
import { apiError, parse, sendError } from "../http.js";

const tokenBody = z.object({ documentId: z.string().min(1) });
const idParam = z.object({ id: z.string().min(1) });
const tokenQuery = z.object({ token: z.string().min(1) });
const payloadSchema = z.object({
  documentId: z.string().min(1),
  exp: z.number().int().positive(),
});

export async function previewRoutes(app: FastifyInstance): Promise<void> {
  const { requireAuth, requirePermission } = makeGuards(app);
  const read = { preHandler: [requireAuth, requirePermission("pages.read")] };

  app.post("/preview/token", read, async (req, reply) => {
    try {
      const body = parse(tokenBody, req.body);
      const token = signPreviewToken({
        documentId: body.documentId,
        exp: Math.floor(Date.now() / 1000) + app.env.PREVIEW_TOKEN_TTL,
      }, app.env.SESSION_SECRET);
      return reply.send({ token });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/preview/builder/documents/:id", async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      const { token } = parse(tokenQuery, req.query);
      const payload = verifyPreviewToken(token, app.env.SESSION_SECRET);
      if (!payload || payload.documentId !== id) {
        return reply.code(401).send(apiError(ErrorCode.Unauthorized, "Token de preview inválido"));
      }
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return reply.code(401).send(apiError(ErrorCode.Unauthorized, "Token de preview expirado"));
      }
      return reply.send(await app.core.builder.get(id));
    } catch (err) {
      return sendError(reply, err);
    }
  });
}

function signPreviewToken(payload: z.infer<typeof payloadSchema>, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyPreviewToken(token: string, secret: string): z.infer<typeof payloadSchema> | null {
  const parts = token.split(".");
  const body = parts[0];
  const sig = parts[1];
  if (!body || !sig || parts.length !== 2) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (!sameToken(sig, expected)) return null;
  try {
    const json = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
    return payloadSchema.parse(json);
  } catch {
    return null;
  }
}

function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

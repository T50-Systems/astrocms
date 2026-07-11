import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { PermissionKey } from "@astrocms/contracts";
import { SESSION_COOKIE } from "@astrocms/cms-auth";
import { ErrorCode } from "@astrocms/contracts";
import { apiError } from "./http.js";

/** Guardas de decisión (autenticación + autorización) para el borde HTTP. */
export function makeGuards(app: FastifyInstance) {
  const requireAuth: preHandlerHookHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) {
      reply.code(401).send(apiError(ErrorCode.Unauthorized, "No autenticado"));
      return reply;
    }
    const session = await app.core.auth.resolveSession(token);
    if (!session) {
      reply.code(401).send(apiError(ErrorCode.Unauthorized, "Sesión inválida o expirada"));
      return reply;
    }
    req.session = session;
  };

  const requirePermission =
    (key: PermissionKey): preHandlerHookHandler =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.session || !req.session.permissions.includes(key)) {
        reply.code(403).send(apiError(ErrorCode.Forbidden, `Falta permiso: ${key}`));
        return reply;
      }
    };

  return { requireAuth, requirePermission };
}

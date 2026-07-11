import type { FastifyInstance } from "fastify";
import { ErrorCode } from "@astrocms/contracts";
import { CSRF_COOKIE, CSRF_HEADER } from "./cookies.js";
import { apiError } from "./http.js";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF por double-submit token: en mutaciones de la API admin exige que el header
 * `x-csrf-token` coincida con la cookie CSRF. Exentas: API pública y el propio login
 * (que aún no tiene cookie). Refuerza a SameSite=Lax + CORS allowlisted.
 */
export function registerCsrf(app: FastifyInstance): void {
  app.addHook("onRequest", async (req, reply) => {
    if (!MUTATING.has(req.method)) return;
    const url = req.url.split("?")[0] ?? "";
    if (!url.startsWith("/api/v1")) return;
    if (url.startsWith("/api/v1/public")) return;
    if (url === "/api/v1/auth/login") return;
    if (url === "/api/v1/auth/dev-login") return; // sólo existe en desarrollo (ver routes/auth.ts)

    const header = req.headers[CSRF_HEADER];
    const cookie = req.cookies[CSRF_COOKIE];
    if (!cookie || typeof header !== "string" || header !== cookie) {
      reply.code(403).send(apiError(ErrorCode.Forbidden, "CSRF token inválido o ausente"));
      return reply;
    }
  });
}

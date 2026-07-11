import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE } from "@astrocms/cms-auth";
import { loginRequestSchema } from "@astrocms/contracts";
import { z } from "zod";
import { clearAuthCookies, setAuthCookies } from "../cookies.js";
import { makeGuards } from "../guards.js";
import { parse, sendError } from "../http.js";

const idParam = z.object({ id: z.string().min(1) });

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const { requireAuth } = makeGuards(app);

  // Rate limit estricto sólo aquí (protección de fuerza bruta).
  app.post("/auth/login", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, reply) => {
    try {
      const body = parse(loginRequestSchema, req.body);
      const ua = req.headers["user-agent"];
      const result = await app.core.auth.login({
        email: body.email,
        password: body.password,
        ttlSeconds: app.env.SESSION_TTL,
        ip: req.ip,
        ...(typeof ua === "string" ? { userAgent: ua } : {}),
      });
      setAuthCookies(reply, app.env, result.token);
      return reply.send({ user: result.user });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // Bypass de DESARROLLO: sólo se registra fuera de producción y si DEV_AUTOLOGIN está definido.
  // En producción esta ruta no existe (404). Inicia sesión como ese usuario sin contraseña.
  const devEmail = app.env.DEV_AUTOLOGIN;
  if (app.env.NODE_ENV !== "production" && devEmail) {
    app.post("/auth/dev-login", async (req, reply) => {
      try {
        const ua = req.headers["user-agent"];
        const result = await app.core.auth.devLogin({
          email: devEmail,
          ttlSeconds: app.env.SESSION_TTL,
          ip: req.ip,
          ...(typeof ua === "string" ? { userAgent: ua } : {}),
        });
        setAuthCookies(reply, app.env, result.token);
        return reply.send({ user: result.user });
      } catch (err) {
        return sendError(reply, err);
      }
    });
    app.log.warn(`⚠️  DEV_AUTOLOGIN activo: /api/v1/auth/dev-login inicia sesión como ${devEmail} SIN contraseña (sólo desarrollo).`);
  }

  app.post("/auth/logout", { preHandler: requireAuth }, async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await app.core.auth.logout(token);
    clearAuthCookies(reply, app.env);
    return reply.code(204).send();
  });

  app.post("/auth/logout-all", { preHandler: requireAuth }, async (req, reply) => {
    await app.core.auth.revokeAllSessions(req.session!.user.id);
    clearAuthCookies(reply, app.env);
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: requireAuth }, async (req, reply) => {
    return reply.send(req.session);
  });

  app.get("/me/sessions", { preHandler: requireAuth }, async (req, reply) => {
    return reply.send(await app.core.auth.listSessions(req.session!.user.id));
  });

  app.delete("/me/sessions/:id", { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { id } = parse(idParam, req.params);
      await app.core.auth.revokeSession(req.session!.user.id, id);
      return reply.code(204).send();
    } catch (err) {
      return sendError(reply, err);
    }
  });
}

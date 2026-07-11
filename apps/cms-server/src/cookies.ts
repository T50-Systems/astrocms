import { randomBytes } from "node:crypto";
import type { FastifyReply } from "fastify";
import { SESSION_COOKIE } from "@astrocms/cms-auth";
import type { Env } from "./env.js";

export const CSRF_COOKIE = "astrocms_csrf";
export const CSRF_HEADER = "x-csrf-token";

function base(env: Env) {
  return {
    path: "/",
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
  };
}

/** Emite cookie de sesión (HttpOnly) + cookie CSRF legible por el panel (double-submit). */
export function setAuthCookies(reply: FastifyReply, env: Env, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, { ...base(env), httpOnly: true, maxAge: env.SESSION_TTL });
  reply.setCookie(CSRF_COOKIE, randomBytes(24).toString("base64url"), {
    ...base(env),
    httpOnly: false,
    maxAge: env.SESSION_TTL,
  });
}

export function clearAuthCookies(reply: FastifyReply, env: Env): void {
  reply.clearCookie(SESSION_COOKIE, base(env));
  reply.clearCookie(CSRF_COOKIE, base(env));
}

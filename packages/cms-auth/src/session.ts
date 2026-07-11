import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "astrocms_session";

export interface IssuedToken {
  /** Valor que va en la cookie (secreto en claro). */
  token: string;
  /** Hash que se persiste en DB (nunca el token en claro). */
  tokenHash: string;
}

/** Genera un token de sesión de alta entropía y su hash SHA-256. */
export function issueSessionToken(): IssuedToken {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comparación en tiempo constante de dos hashes hex. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function sessionExpiry(now: Date, ttlSeconds: number): Date {
  return new Date(now.getTime() + ttlSeconds * 1000);
}

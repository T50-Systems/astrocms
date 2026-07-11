import type { FastifyReply } from "fastify";
import { z } from "zod";
import { ErrorCode, type ApiError } from "@astrocms/contracts";
import { DomainError } from "@astrocms/cms-core";

const STATUS_BY_CODE: Record<string, number> = {
  [ErrorCode.Unauthorized]: 401,
  [ErrorCode.Forbidden]: 403,
  [ErrorCode.NotFound]: 404,
  [ErrorCode.Validation]: 400,
  [ErrorCode.Conflict]: 409,
  [ErrorCode.RateLimited]: 429,
  [ErrorCode.Internal]: 500,
};

export function apiError(code: string, message: string, details?: unknown): ApiError {
  return { error: { code, message, ...(details !== undefined ? { details } : {}) } };
}

/** Traduce errores de dominio/validación a respuestas HTTP tipadas (borde fino). */
export function sendError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof DomainError) {
    return reply.code(STATUS_BY_CODE[err.code] ?? 500).send(apiError(err.code, err.message, err.details));
  }
  if (err instanceof z.ZodError) {
    return reply.code(400).send(apiError(ErrorCode.Validation, "Datos inválidos", err.issues));
  }
  reply.log.error(err);
  return reply.code(500).send(apiError(ErrorCode.Internal, "Error interno"));
}

/** Valida y devuelve datos; lanza ZodError (capturado por sendError). */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

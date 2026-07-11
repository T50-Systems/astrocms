import { ErrorCode } from "@astrocms/contracts";

/** Error de dominio con código estable → el borde HTTP lo mapea a status. */
export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const notFound = (msg = "No encontrado") => new DomainError(ErrorCode.NotFound, msg);
export const unauthorized = (msg = "No autenticado") =>
  new DomainError(ErrorCode.Unauthorized, msg);
export const forbidden = (msg = "Sin permiso") => new DomainError(ErrorCode.Forbidden, msg);
export const conflict = (msg = "Conflicto", details?: unknown) =>
  new DomainError(ErrorCode.Conflict, msg, details);
export const validation = (msg = "Datos inválidos", details?: unknown) =>
  new DomainError(ErrorCode.Validation, msg, details);

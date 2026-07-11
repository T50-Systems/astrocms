import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "./schema.js";

export type Database = ReturnType<typeof createDb>["db"];

/** Comprobación de conectividad para health checks (no expone drizzle al borde). */
export async function pingDb(db: Database): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Crea la conexión a Postgres. `DATABASE_URL` apunta a cualquier Postgres
 * (auto-hospedado o gestionado) — infra-agnóstico (ADR-0008).
 */
export function createDb(connectionString: string, opts?: { max?: number }) {
  const sql = postgres(connectionString, { max: opts?.max ?? 10 });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end() };
}

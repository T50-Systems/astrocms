import { and, eq, gt, isNull } from "drizzle-orm";
import {
  issueSessionToken,
  hashToken,
  permissionsForRoles,
  sessionExpiry,
  verifyPassword,
} from "@astrocms/cms-auth";
import type { Session, User } from "@astrocms/contracts";
import { roles, sessions, userRoles, users } from "@astrocms/cms-database";
import type { Database } from "@astrocms/cms-database";
import { unauthorized } from "./errors.js";
import type { Clock } from "./ports.js";

async function roleSlugsFor(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
  return rows.map((r) => r.slug);
}

function toUser(
  row: { id: string; email: string; name: string; status: "active" | "disabled"; createdAt: Date },
  roleSlugs: string[],
): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    roles: roleSlugs,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface LoginResult {
  user: User;
  token: string;
  expiresAt: string;
}

export function createAuthService(db: Database, clock: Clock) {
  return {
    async login(input: {
      email: string;
      password: string;
      ttlSeconds: number;
      ip?: string;
      userAgent?: string;
    }): Promise<LoginResult> {
      const row = (
        await db.select().from(users).where(eq(users.email, input.email)).limit(1)
      )[0];
      // Mensaje uniforme para no filtrar si el email existe.
      if (!row || row.status !== "active") throw unauthorized("Credenciales inválidas");
      const ok = await verifyPassword(row.passwordHash, input.password);
      if (!ok) throw unauthorized("Credenciales inválidas");

      const { token, tokenHash } = issueSessionToken();
      const expiresAt = sessionExpiry(clock.now(), input.ttlSeconds);
      await db.insert(sessions).values({
        userId: row.id,
        tokenHash,
        expiresAt,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      });
      const roleSlugs = await roleSlugsFor(db, row.id);
      return { user: toUser(row, roleSlugs), token, expiresAt: expiresAt.toISOString() };
    },

    async resolveSession(token: string): Promise<Session | null> {
      const tokenHash = hashToken(token);
      const now = clock.now();
      const row = (
        await db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.tokenHash, tokenHash),
              isNull(sessions.revokedAt),
              gt(sessions.expiresAt, now),
            ),
          )
          .limit(1)
      )[0];
      if (!row) return null;
      const userRow = (await db.select().from(users).where(eq(users.id, row.userId)).limit(1))[0];
      if (!userRow || userRow.status !== "active") return null;
      const roleSlugs = await roleSlugsFor(db, userRow.id);
      return {
        user: toUser(userRow, roleSlugs),
        permissions: permissionsForRoles(roleSlugs),
        expiresAt: row.expiresAt.toISOString(),
      };
    },

    async logout(token: string): Promise<void> {
      const tokenHash = hashToken(token);
      await db
        .update(sessions)
        .set({ revokedAt: clock.now() })
        .where(eq(sessions.tokenHash, tokenHash));
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

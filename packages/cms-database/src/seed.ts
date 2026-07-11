import { eq } from "drizzle-orm";
import { hashPassword, ROLE_PERMISSIONS } from "@astrocms/cms-auth";
import { KnownPermissions } from "@astrocms/contracts";
import { createDb } from "./client.js";
import {
  contentTypes,
  menus,
  permissions,
  rolePermissions,
  roles,
  settings,
  sites,
  userRoles,
  users,
} from "./schema.js";

/** Seed idempotente para desarrollo: site, permisos, roles admin/editor, usuarios, content types. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definido");
  const { db, close } = createDb(url, { max: 1 });

  // Site (uno solo en el MVP).
  const existingSite = await db.select().from(sites).limit(1);
  const site =
    existingSite[0] ??
    (await db
      .insert(sites)
      .values({ name: "Demo", primaryDomain: "localhost", localeDefault: "es" })
      .returning())[0]!;
  console.log(`[seed] site: ${site.id}`);

  // Permisos (catálogo global).
  for (const key of KnownPermissions) {
    await db.insert(permissions).values({ key }).onConflictDoNothing();
  }
  const allPerms = await db.select().from(permissions);
  const permByKey = new Map(allPerms.map((p) => [p.key, p.id] as const));

  // Roles + role_permissions.
  for (const slug of ["admin", "editor"] as const) {
    await db
      .insert(roles)
      .values({ siteId: site.id, slug, name: slug === "admin" ? "Administrador" : "Editor", isSystem: true })
      .onConflictDoNothing();
    const role = (await db.select().from(roles).where(eq(roles.slug, slug)).limit(1))[0]!;
    for (const permKey of ROLE_PERMISSIONS[slug] ?? []) {
      const permId = permByKey.get(permKey);
      if (permId) {
        await db
          .insert(rolePermissions)
          .values({ roleId: role.id, permissionId: permId })
          .onConflictDoNothing();
      }
    }
  }

  // Usuarios demo.
  const demoUsers = [
    { email: "admin@astrocms.local", name: "Admin", password: "Admin!2345", role: "admin" },
    { email: "editor@astrocms.local", name: "Editor", password: "Editor!2345", role: "editor" },
  ] as const;
  for (const u of demoUsers) {
    const existing = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
    let userId = existing[0]?.id;
    if (!userId) {
      const passwordHash = await hashPassword(u.password);
      userId = (
        await db
          .insert(users)
          .values({ siteId: site.id, email: u.email, name: u.name, passwordHash })
          .returning()
      )[0]!.id;
      console.log(`[seed] usuario ${u.email} (${u.password})`);
    }
    const role = (await db.select().from(roles).where(eq(roles.slug, u.role)).limit(1))[0]!;
    await db.insert(userRoles).values({ userId, roleId: role.id }).onConflictDoNothing();
  }

  // Content types de sistema.
  for (const ct of [
    { key: "page", name: "Página", kind: "page" as const },
    { key: "post", name: "Entrada", kind: "post" as const },
  ]) {
    await db
      .insert(contentTypes)
      .values({ siteId: site.id, key: ct.key, name: ct.name, kind: ct.kind, isSystem: true })
      .onConflictDoNothing();
  }

  await db
    .insert(menus)
    .values({ siteId: site.id, location: "primary", name: "Primary" })
    .onConflictDoNothing();

  for (const row of [
    { group: "site", key: "title", value: "AstroCMS Demo" },
    { group: "site", key: "description", value: "Sitio demo de AstroCMS" },
  ] as const) {
    await db
      .insert(settings)
      .values({ siteId: site.id, group: row.group, key: row.key, value: row.value })
      .onConflictDoNothing();
  }

  await close();
  console.log("[seed] listo");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

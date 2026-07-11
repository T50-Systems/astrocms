import type { PermissionKey, RoleSlug } from "@astrocms/contracts";

/** Permisos por rol de sistema. `admin` = todo; `editor` = contenido + medios. */
export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  admin: [
    "pages.read",
    "pages.write",
    "pages.publish",
    "pages.delete",
    "media.read",
    "media.write",
    "media.delete",
    "menus.write",
    "settings.write",
    "users.manage",
    "webhooks.manage",
  ],
  editor: ["pages.read", "pages.write", "pages.publish", "media.read", "media.write"],
};

/** Resuelve el conjunto de permisos efectivos de un usuario a partir de sus roles. */
export function permissionsForRoles(roles: RoleSlug[]): PermissionKey[] {
  const set = new Set<PermissionKey>();
  for (const role of roles) {
    for (const perm of ROLE_PERMISSIONS[role] ?? []) set.add(perm);
  }
  return [...set];
}

export function hasPermission(perms: PermissionKey[], required: PermissionKey): boolean {
  return perms.includes(required);
}

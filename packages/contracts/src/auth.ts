import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common.js";

/** Slugs de rol conocidos; extensible por plugins/proyecto. */
export const roleSlugSchema = z.string().min(1);
export type RoleSlug = z.infer<typeof roleSlugSchema>;

/** Catálogo de permisos del núcleo. String abierto para extensiones. */
export const KnownPermissions = [
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
] as const;
export const permissionKeySchema = z.string().min(1);
export type PermissionKey = (typeof KnownPermissions)[number] | (string & {});

export const userStatusSchema = z.enum(["active", "disabled"]);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const userSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  name: z.string(),
  status: userStatusSchema,
  roles: z.array(roleSlugSchema),
  createdAt: isoDateTimeSchema,
});
export type User = z.infer<typeof userSchema>;

export const sessionSchema = z.object({
  user: userSchema,
  permissions: z.array(permissionKeySchema),
  expiresAt: isoDateTimeSchema,
});
export type Session = z.infer<typeof sessionSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({ user: userSchema });
export type LoginResponse = z.infer<typeof loginResponseSchema>;

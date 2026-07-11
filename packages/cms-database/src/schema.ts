import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema del slice inicial. Single-site pero multisite-ready: todo lleva site_id.
 * Sólo se usan features de Postgres core (uuid, jsonb, timestamptz) — infra-agnóstico (ADR-0008).
 */

export const sites = pgTable("sites", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  primaryDomain: text("primary_domain"),
  localeDefault: text("locale_default").notNull().default("es"),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    status: text("status", { enum: ["active", "disabled"] })
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ emailPerSite: unique("users_site_email_uq").on(t.siteId, t.email) }),
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
  },
  (t) => ({ slugPerSite: unique("roles_site_slug_uq").on(t.siteId, t.slug) }),
);

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.roleId, t.permissionId] }) }),
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.roleId] }) }),
);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const contentTypes = pgTable(
  "content_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["page", "post", "custom"] }).notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    supports: jsonb("supports").notNull().default({ seo: true, revisions: true, builder: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ keyPerSite: unique("content_types_site_key_uq").on(t.siteId, t.key) }),
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    contentTypeId: uuid("content_type_id")
      .notNull()
      .references(() => contentTypes.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    editorType: text("editor_type", { enum: ["rich-text", "markdown", "builder"] })
      .notNull()
      .default("rich-text"),
    // Punteros lógicos a entry_versions (sin FK para evitar ciclo de inserción).
    currentVersionId: uuid("current_version_id"),
    publishedVersionId: uuid("published_version_id"),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ slugPerType: unique("entries_site_type_slug_uq").on(t.siteId, t.contentTypeId, t.slug) }),
);

export const entryVersions = pgTable(
  "entry_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    title: text("title").notNull(),
    data: jsonb("data").notNull().default({}),
    seo: jsonb("seo").notNull().default({}),
    builderDocumentId: uuid("builder_document_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
  },
  (t) => ({ versionPerEntry: unique("entry_versions_entry_no_uq").on(t.entryId, t.versionNo) }),
);

export const builderDocuments = pgTable("builder_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  entryId: uuid("entry_id").references(() => entries.id, { onDelete: "set null" }),
  schemaVersion: integer("schema_version").notNull().default(1),
  currentVersionId: uuid("current_version_id"),
  publishedVersionId: uuid("published_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const builderDocumentVersions = pgTable(
  "builder_document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => builderDocuments.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    tree: jsonb("tree").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
  },
  (t) => ({ versionPerDoc: unique("builder_doc_versions_no_uq").on(t.documentId, t.versionNo) }),
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt"),
    title: text("title"),
    checksumSha256: text("checksum_sha256").notNull(),
    folder: text("folder"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ siteCreatedAt: index("media_assets_site_created_at_idx").on(t.siteId, t.createdAt) }),
);

export const mediaVariants = pgTable(
  "media_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    width: integer("width"),
    height: integer("height"),
    bytes: integer("bytes").notNull(),
    mime: text("mime").notNull(),
  },
  (t) => ({ asset: index("media_variants_asset_idx").on(t.assetId) }),
);

export const menus = pgTable(
  "menus",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    location: text("location").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ locationPerSite: unique("menus_site_location_uq").on(t.siteId, t.location) }),
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => menuItems.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    label: text("label").notNull(),
    linkType: text("link_type", { enum: ["entry", "url", "custom"] }).notNull(),
    entryId: uuid("entry_id").references(() => entries.id, { onDelete: "set null" }),
    url: text("url"),
    target: text("target", { enum: ["_self", "_blank"] }),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ menuPosition: index("menu_items_menu_position_idx").on(t.menuId, t.position) }),
);

export const settings = pgTable(
  "settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    group: text("group").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ keyPerGroup: unique("settings_site_group_key_uq").on(t.siteId, t.group, t.key) }),
);

export const webhooks = pgTable("webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  targetUrl: text("target_url").notNull(),
  secret: text("secret").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  statusCode: integer("status_code"),
  error: text("error"),
  attempt: integer("attempt").notNull().default(1),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull().defaultNow(),
});

export const entriesRelations = relations(entries, ({ one, many }) => ({
  contentType: one(contentTypes, {
    fields: [entries.contentTypeId],
    references: [contentTypes.id],
  }),
  author: one(users, { fields: [entries.authorId], references: [users.id] }),
  versions: many(entryVersions),
}));

export const entryVersionsRelations = relations(entryVersions, ({ one }) => ({
  entry: one(entries, { fields: [entryVersions.entryId], references: [entries.id] }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ many, one }) => ({
  site: one(sites, { fields: [mediaAssets.siteId], references: [sites.id] }),
  variants: many(mediaVariants),
}));

export const mediaVariantsRelations = relations(mediaVariants, ({ one }) => ({
  asset: one(mediaAssets, { fields: [mediaVariants.assetId], references: [mediaAssets.id] }),
}));

export const menusRelations = relations(menus, ({ one, many }) => ({
  site: one(sites, { fields: [menus.siteId], references: [sites.id] }),
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  menu: one(menus, { fields: [menuItems.menuId], references: [menus.id] }),
  parent: one(menuItems, { fields: [menuItems.parentId], references: [menuItems.id] }),
  children: many(menuItems),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  site: one(sites, { fields: [webhooks.siteId], references: [sites.id] }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, { fields: [webhookDeliveries.webhookId], references: [webhooks.id] }),
}));

export const schema = {
  sites,
  users,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  sessions,
  contentTypes,
  entries,
  entryVersions,
  builderDocuments,
  builderDocumentVersions,
  mediaAssets,
  mediaVariants,
  menus,
  menuItems,
  settings,
  webhooks,
  webhookDeliveries,
  entriesRelations,
  entryVersionsRelations,
  mediaAssetsRelations,
  mediaVariantsRelations,
  menusRelations,
  menuItemsRelations,
  webhooksRelations,
  webhookDeliveriesRelations,
};

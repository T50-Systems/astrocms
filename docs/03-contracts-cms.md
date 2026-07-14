# 03 — CMS TypeScript contracts

These types live in `packages/contracts` (with their parallel Zod schemas). They are the **single
source of truth**: the server validates with the Zod schemas, `cms-sdk` re-exports them, the panel
consumes them. No duplication in front/back.

Convention: for every type `Foo` there is a `FooSchema` (Zod) and `type Foo = z.infer<typeof FooSchema>`.
Here only the `type`s are shown for brevity; the `*Schema`s are generated/defined alongside them.

## 1. Primitives and wrappers

```ts
export type ID = string;                 // uuid/ulid
export type ISODateTime = string;        // '2026-07-10T12:00:00.000Z'

export type EditorType = "rich-text" | "markdown" | "builder";
export type EntryStatus = "draft" | "published" | "archived";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type ApiError = {
  error: {
    code: string;            // 'unauthorized', 'validation_error', 'not_found', ...
    message: string;
    details?: unknown;       // e.g. Zod issues
  };
};

// API versioning: /api/v1 prefix + optional 'X-Api-Version' header.
export const API_VERSION = "v1" as const;
```

## 2. Identity and session

```ts
export interface User {
  id: ID;
  email: string;
  name: string;
  status: "active" | "disabled";
  roles: RoleSlug[];
  createdAt: ISODateTime;
}

export type RoleSlug = "admin" | "editor" | (string & {});   // extensible by plugins

export interface Session {
  user: User;
  permissions: PermissionKey[];
  expiresAt: ISODateTime;
}

export type PermissionKey =
  | "pages.read" | "pages.write" | "pages.publish" | "pages.delete"
  | "media.read" | "media.write" | "media.delete"
  | "menus.write" | "settings.write" | "users.manage" | "webhooks.manage"
  | (string & {});

export interface LoginRequest { email: string; password: string; }
export interface LoginResponse { user: User; }     // the session is set via an HTTP-only cookie
```

## 3. Content types and fields

```ts
export type ContentTypeKind = "page" | "post" | "custom";

export interface ContentType {
  id: ID;
  key: string;                       // 'page', 'post', 'service', ...
  name: string;
  kind: ContentTypeKind;
  supports: { seo: boolean; revisions: boolean; builder: boolean };
  fields: FieldDefinition[];
}

// The field system lives in `packages/schemas`; only the serializable shape is shown here.
export interface FieldDefinition {
  key: string;
  type: FieldType;                   // 'text' | 'richText' | 'media' | 'repeater' | ...
  label: string;
  required: boolean;
  config: Record<string, unknown>;   // validated by the field type descriptor
  position: number;
}

export type FieldType =
  | "text" | "textarea" | "richText" | "number" | "boolean"
  | "select" | "multiSelect" | "date" | "dateTime"
  | "colorToken" | "spacingToken" | "url" | "slug"
  | "media" | "gallery" | "relation" | "taxonomy"
  | "object" | "repeater" | "blocks" | "json"
  | (string & {});                   // 'plugin:*' for plugin fields
```

## 4. Entries / pages

`Page` is sugar over `Entry` with `contentType.kind === 'page'`.

```ts
export interface Entry {
  id: ID;
  contentTypeKey: string;
  title: string;
  slug: string;
  status: EntryStatus;
  editorType: EditorType;
  data: Record<string, unknown>;     // field values (validated by the content type)
  seo: SeoMeta;
  builderDocumentId?: ID;            // only if editorType === 'builder'
  publishedVersionNo?: number;
  currentVersionNo: number;
  authorId: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SeoMeta {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  ogImageAssetId?: ID;
  extra?: Record<string, string>;
}

export interface CreateEntryRequest {
  contentTypeKey: string;
  title: string;
  slug?: string;                     // auto-generated if missing
  editorType: EditorType;
  data?: Record<string, unknown>;
}

export type UpdateEntryRequest = Partial<
  Pick<Entry, "title" | "slug" | "data" | "seo" | "editorType">
>;

export interface EntryRevision {
  versionNo: number;
  title: string;
  createdBy: ID;
  createdAt: ISODateTime;
  note?: string;
  isPublished: boolean;
}
```

## 5. Media

```ts
export interface MediaAsset {
  id: ID;
  filename: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  alt?: string;
  title?: string;
  url: string;                       // served URL (signed if the driver requires it)
  variants: MediaVariant[];
  createdAt: ISODateTime;
}

export interface MediaVariant {
  kind: string;                      // 'thumb' | 'md' | 'webp' | ...
  url: string;
  width?: number;
  height?: number;
}

export interface MediaQuery {
  search?: string;
  mime?: string;                     // prefix, e.g. 'image/'
  folder?: string;
  page?: number;
  pageSize?: number;
}
```

## 6. Menus and settings

```ts
export interface Menu {
  location: string;                  // 'primary' | 'footer' | ...
  name: string;
  items: MenuItem[];
}
export interface MenuItem {
  id: ID;
  label: string;
  linkType: "entry" | "url" | "custom";
  entryId?: ID;
  url?: string;
  target?: "_self" | "_blank";
  children: MenuItem[];
}

export interface SettingsGroup {
  group: string;                     // 'site' | 'seo' | 'social' | ...
  values: Record<string, unknown>;
}
```

## 7. Webhooks

```ts
export type WebhookEvent =
  | "entry.published" | "entry.unpublished" | "entry.deleted"
  | "media.created" | "media.deleted" | (string & {});

export interface Webhook {
  id: ID;
  event: WebhookEvent;
  targetUrl: string;
  active: boolean;
}

export interface WebhookPayload<T = unknown> {
  event: WebhookEvent;
  siteId: ID;
  data: T;
  deliveredAt: ISODateTime;
  signature: string;                 // HMAC-SHA256 of the body using the webhook secret
}
```

## 8. CMS SDK surface (`packages/cms-sdk`)

Typed client; the builder only knows this much of the CMS, never the database.

```ts
export interface CmsClient {
  auth: {
    login(req: LoginRequest): Promise<LoginResponse>;
    logout(): Promise<void>;
    me(): Promise<Session>;
  };
  pages: EntryResource;              // sugar: contentTypeKey='page'
  entries(contentTypeKey: string): EntryResource;
  media: {
    list(q?: MediaQuery): Promise<Paginated<MediaAsset>>;
    get(id: ID): Promise<MediaAsset>;
    upload(file: File | Blob, meta?: { alt?: string }): Promise<MediaAsset>;
    remove(id: ID): Promise<void>;
  };
  menus: { list(): Promise<Menu[]>; get(location: string): Promise<Menu>; };
  settings: { get(group: string): Promise<SettingsGroup>; };
  builder: {
    getDocument(id: ID): Promise<import("./builder").BuilderDocument>;
    saveDocument(id: ID, doc: import("./builder").BuilderDocument): Promise<void>;
    validate(id: ID, doc: import("./builder").BuilderDocument): Promise<ValidationResult>;
    manifest(): Promise<import("./builder").BlockManifest>;
  };
}

export interface EntryResource {
  list(q?: { status?: EntryStatus; page?: number; pageSize?: number }): Promise<Paginated<Entry>>;
  get(id: ID): Promise<Entry>;
  create(req: CreateEntryRequest): Promise<Entry>;
  update(id: ID, req: UpdateEntryRequest): Promise<Entry>;
  remove(id: ID): Promise<void>;
  publish(id: ID): Promise<Entry>;
  unpublish(id: ID): Promise<Entry>;
  revisions(id: ID): Promise<EntryRevision[]>;
  restore(id: ID, versionNo: number): Promise<Entry>;
}

export interface ValidationResult {
  valid: boolean;
  issues: Array<{ nodeId?: string; path?: string; code: string; message: string }>;
}

export function createCmsClient(opts: {
  baseUrl: string;                   // '/api/v1'
  fetch?: typeof fetch;              // injectable for SSR/tests
  credentials?: RequestCredentials;  // 'include' for cookies
}): CmsClient;
```

## 9. REST API v1 map → contracts

| Method/Route | Request | Response |
|---|---|---|
| `POST /auth/login` | `LoginRequest` | `LoginResponse` |
| `POST /auth/logout` | — | `204` |
| `GET /me` | — | `Session` |
| `GET /pages` | query | `Paginated<Entry>` |
| `POST /pages` | `CreateEntryRequest` | `Entry` |
| `GET /pages/{id}` | — | `Entry` |
| `PATCH /pages/{id}` | `UpdateEntryRequest` | `Entry` |
| `DELETE /pages/{id}` | — | `204` |
| `POST /pages/{id}/publish` | — | `Entry` |
| `POST /pages/{id}/unpublish` | — | `Entry` |
| `GET /pages/{id}/revisions` | — | `EntryRevision[]` |
| `POST /pages/{id}/restore/{versionNo}` | — | `Entry` |
| `GET /media` | `MediaQuery` | `Paginated<MediaAsset>` |
| `POST /media` | multipart | `MediaAsset` |
| `DELETE /media/{id}` | — | `204` |
| `GET /builder/documents/{id}` | — | `BuilderDocument` |
| `PUT /builder/documents/{id}` | `BuilderDocument` | `204` |
| `POST /builder/documents/{id}/validate` | `BuilderDocument` | `ValidationResult` |
| `GET /builder/manifest` | — | `BlockManifest` |
| `GET /menus`, `GET /settings` | — | `Menu[]`, `SettingsGroup` |

Surface separation (see [01-architecture](01-architecture.md)):
`/admin/*` (session+RBAC), `/public/*` (published only, no auth), `/preview/*` (token/session).
The map above uses short routes; on the server they hang off `/api/v1/admin` except for the public ones.

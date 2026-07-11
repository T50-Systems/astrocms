# 03 — Contratos TypeScript del CMS

Estos tipos viven en `packages/contracts` (con sus esquemas Zod paralelos). Son la **fuente
única de verdad**: el servidor valida con los Zod, el `cms-sdk` los reexporta, el panel los
consume. No se duplican en front/back.

Convención: por cada tipo `Foo` existe `FooSchema` (Zod) y `type Foo = z.infer<typeof FooSchema>`.
Aquí se muestran los `type` por brevedad; los `*Schema` se generan/definen junto a ellos.

## 1. Primitivos y envoltorios

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
    details?: unknown;       // p.ej. issues de Zod
  };
};

// Versionado de API: prefijo /api/v1 + header opcional 'X-Api-Version'.
export const API_VERSION = "v1" as const;
```

## 2. Identidad y sesión

```ts
export interface User {
  id: ID;
  email: string;
  name: string;
  status: "active" | "disabled";
  roles: RoleSlug[];
  createdAt: ISODateTime;
}

export type RoleSlug = "admin" | "editor" | (string & {});   // extensible por plugins

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
export interface LoginResponse { user: User; }     // la sesión va en cookie HTTP-only
```

## 3. Content types y campos

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

// El sistema de campos vive en `packages/schemas`; aquí sólo la forma serializable.
export interface FieldDefinition {
  key: string;
  type: FieldType;                   // 'text' | 'richText' | 'media' | 'repeater' | ...
  label: string;
  required: boolean;
  config: Record<string, unknown>;   // validado por el descriptor del tipo de campo
  position: number;
}

export type FieldType =
  | "text" | "textarea" | "richText" | "number" | "boolean"
  | "select" | "multiSelect" | "date" | "dateTime"
  | "colorToken" | "spacingToken" | "url" | "slug"
  | "media" | "gallery" | "relation" | "taxonomy"
  | "object" | "repeater" | "blocks" | "json"
  | (string & {});                   // 'plugin:*' para campos de plugin
```

## 4. Entradas / páginas

`Page` es azúcar sobre `Entry` con `contentType.kind === 'page'`.

```ts
export interface Entry {
  id: ID;
  contentTypeKey: string;
  title: string;
  slug: string;
  status: EntryStatus;
  editorType: EditorType;
  data: Record<string, unknown>;     // valores de los campos (validados por el content type)
  seo: SeoMeta;
  builderDocumentId?: ID;            // sólo si editorType === 'builder'
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
  slug?: string;                     // autogenerado si falta
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

## 5. Medios

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
  url: string;                       // URL servida (firmada si el driver lo requiere)
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
  mime?: string;                     // prefijo, p.ej. 'image/'
  folder?: string;
  page?: number;
  pageSize?: number;
}
```

## 6. Menús y ajustes

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
  signature: string;                 // HMAC-SHA256 del cuerpo con el secreto del webhook
}
```

## 8. Superficie del SDK del CMS (`packages/cms-sdk`)

Cliente tipado; el builder sólo conoce esto del CMS, jamás la base de datos.

```ts
export interface CmsClient {
  auth: {
    login(req: LoginRequest): Promise<LoginResponse>;
    logout(): Promise<void>;
    me(): Promise<Session>;
  };
  pages: EntryResource;              // azúcar: contentTypeKey='page'
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
  fetch?: typeof fetch;              // inyectable para SSR/tests
  credentials?: RequestCredentials;  // 'include' para cookies
}): CmsClient;
```

## 9. Mapa API REST v1 → contratos

| Método/Ruta | Request | Response |
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

Separación de superficies (ver [01-architecture](01-architecture.md)):
`/admin/*` (sesión+RBAC), `/public/*` (sólo publicado, sin auth), `/preview/*` (token/sesión).
El mapa de arriba usa rutas cortas; en el servidor cuelgan de `/api/v1/admin` salvo las públicas.

import type {
  BuilderDocument,
  BlockManifest,
  BuilderNode,
  BuilderRevision,
  AuditLogEntry,
  CreateEntryRequest,
  Entry,
  EntryRevision,
  EntryStatus,
  EntryStatusCounts,
  ListAuditQuery,
  LoginRequest,
  LoginResponse,
  Menu,
  MediaAsset,
  MediaFolder,
  MediaQuery,
  UpdateMediaRequest,
  Paginated,
  Session,
  SettingsGroup,
  Taxonomy,
  TaxonomyDetail,
  Term,
  TermRef,
  UpdateEntryRequest,
  UpsertTermRequest,
  UpsertMenuRequest,
  UserSession,
  CreateWebhookRequest,
  Webhook,
} from "@astrocms/contracts";
import { createHttp, type CmsClientOptions } from "./http.js";

export { CmsClientError, type CmsClientOptions } from "./http.js";

export interface EntryResource {
  list(q?: { status?: EntryStatus; search?: string; page?: number; pageSize?: number }): Promise<Paginated<Entry>>;
  counts(): Promise<EntryStatusCounts>;
  get(id: string): Promise<Entry>;
  create(req: CreateEntryRequest): Promise<Entry>;
  update(id: string, req: UpdateEntryRequest): Promise<Entry>;
  publish(id: string): Promise<Entry>;
  unpublish(id: string): Promise<Entry>;
  remove(id: string): Promise<void>;
  revisions(id: string): Promise<EntryRevision[]>;
  restore(id: string, versionNo: number): Promise<Entry>;
}

export interface BuilderResource {
  manifest(): Promise<BlockManifest>;
  create(root: BuilderNode, entryId?: string): Promise<BuilderDocument>;
  getDocument(id: string): Promise<BuilderDocument>;
  saveDocument(id: string, doc: BuilderDocument): Promise<void>;
  publish(id: string): Promise<void>;
  revisions(id: string): Promise<BuilderRevision[]>;
  restore(id: string, revisionId: string): Promise<BuilderDocument>;
}

export interface MediaResource {
  list(q?: MediaQuery): Promise<Paginated<MediaAsset>>;
  folders(): Promise<MediaFolder[]>;
  get(id: string): Promise<MediaAsset>;
  upload(file: File | Blob, meta?: { alt?: string; folder?: string }): Promise<MediaAsset>;
  update(id: string, patch: UpdateMediaRequest): Promise<MediaAsset>;
  remove(id: string): Promise<void>;
}

export interface MenuResource {
  list(): Promise<Menu[]>;
  get(location: string): Promise<Menu>;
  upsert(location: string, req: UpsertMenuRequest): Promise<Menu>;
  remove(location: string): Promise<void>;
}

export interface SettingsResource {
  get(group: string): Promise<SettingsGroup>;
  set(group: string, values: Record<string, unknown>): Promise<SettingsGroup>;
}

export interface WebhookResource {
  list(): Promise<Webhook[]>;
  create(req: CreateWebhookRequest): Promise<Webhook>;
  remove(id: string): Promise<void>;
}

export interface TaxonomyResource {
  list(): Promise<Taxonomy[]>;
  get(key: string): Promise<TaxonomyDetail>;
  upsertTerm(key: string, term: UpsertTermRequest): Promise<Term>;
  deleteTerm(key: string, termId: string): Promise<void>;
  entryTerms(entryId: string): Promise<TermRef[]>;
  setEntryTerms(entryId: string, termIds: string[]): Promise<TermRef[]>;
}

export interface PreviewResource {
  createToken(documentId: string): Promise<{ token: string }>;
  getBuilderDocument(id: string, token: string): Promise<BuilderDocument>;
}

export interface AuditResource {
  list(q?: Partial<ListAuditQuery>): Promise<Paginated<AuditLogEntry>>;
}

export interface CmsClient {
  auth: {
    login(req: LoginRequest): Promise<LoginResponse>;
    /** Bypass de desarrollo (sin contraseña); sólo funciona si el servidor lo habilita. */
    devLogin(): Promise<LoginResponse>;
    logout(): Promise<void>;
    logoutAll(): Promise<void>;
    me(): Promise<Session>;
  };
  me: {
    get(): Promise<Session>;
    sessions: {
      list(): Promise<UserSession[]>;
      revoke(id: string): Promise<void>;
    };
  };
  pages: EntryResource;
  media: MediaResource;
  menus: MenuResource;
  settings: SettingsResource;
  webhooks: WebhookResource;
  taxonomies: TaxonomyResource;
  builder: BuilderResource;
  preview: PreviewResource;
  audit: AuditResource;
  public: {
    getPageBySlug(slug: string): Promise<Entry | null>;
    getBuilderDocument(id: string): Promise<BuilderDocument | null>;
    getMenu(location: string): Promise<Menu>;
    getSettings(group: string): Promise<SettingsGroup>;
    getTaxonomy(key: string): Promise<TaxonomyDetail>;
  };
}

/** Cliente tipado de la API v1. Reutiliza los contratos; no duplica esquemas. */
export function createCmsClient(opts: CmsClientOptions): CmsClient {
  const request = createHttp(opts);
  const base = "/pages";

  return {
    auth: {
      login: (req) => request<LoginResponse>("POST", "/auth/login", { body: req }),
      devLogin: () => request<LoginResponse>("POST", "/auth/dev-login"),
      logout: () => request<void>("POST", "/auth/logout"),
      logoutAll: () => request<void>("POST", "/auth/logout-all"),
      me: () => request<Session>("GET", "/me"),
    },
    me: {
      get: () => request<Session>("GET", "/me"),
      sessions: {
        list: () => request<UserSession[]>("GET", "/me/sessions"),
        revoke: (id) => request<void>("DELETE", `/me/sessions/${id}`),
      },
    },
    pages: {
      list: (q) =>
        request<Paginated<Entry>>("GET", base, {
          query: { status: q?.status, search: q?.search, page: q?.page, pageSize: q?.pageSize },
        }),
      counts: () => request<EntryStatusCounts>("GET", `${base}/counts`),
      get: (id) => request<Entry>("GET", `${base}/${id}`),
      create: (req) => request<Entry>("POST", base, { body: req }),
      update: (id, req) => request<Entry>("PATCH", `${base}/${id}`, { body: req }),
      publish: (id) => request<Entry>("POST", `${base}/${id}/publish`),
      unpublish: (id) => request<Entry>("POST", `${base}/${id}/unpublish`),
      remove: (id) => request<void>("DELETE", `${base}/${id}`),
      revisions: (id) => request<EntryRevision[]>("GET", `${base}/${id}/revisions`),
      restore: (id, versionNo) => request<Entry>("POST", `${base}/${id}/restore/${versionNo}`),
    },
    media: {
      list: (q) =>
        request<Paginated<MediaAsset>>("GET", "/media", {
          query: {
            search: q?.search,
            mime: q?.mime,
            folder: q?.folder,
            page: q?.page,
            pageSize: q?.pageSize,
          },
        }),
      folders: () => request<MediaFolder[]>("GET", "/media/folders"),
      get: (id) => request<MediaAsset>("GET", `/media/${id}`),
      upload: (file, meta) => {
        const form = new FormData();
        const filename = typeof File !== "undefined" && file instanceof File ? file.name : "upload";
        form.append("file", file, filename);
        if (meta?.alt) form.append("alt", meta.alt);
        if (meta?.folder) form.append("folder", meta.folder);
        return request<MediaAsset>("POST", "/media", { body: form });
      },
      update: (id, patch) => request<MediaAsset>("PATCH", `/media/${id}`, { body: patch }),
      remove: (id) => request<void>("DELETE", `/media/${id}`),
    },
    menus: {
      list: () => request<Menu[]>("GET", "/menus"),
      get: (location) => request<Menu>("GET", `/menus/${encodeURIComponent(location)}`),
      upsert: (location, req) => request<Menu>("PUT", `/menus/${encodeURIComponent(location)}`, { body: req }),
      remove: (location) => request<void>("DELETE", `/menus/${encodeURIComponent(location)}`),
    },
    settings: {
      get: (group) => request<SettingsGroup>("GET", `/settings/${encodeURIComponent(group)}`),
      set: (group, values) =>
        request<SettingsGroup>("PUT", `/settings/${encodeURIComponent(group)}`, { body: { values } }),
    },
    webhooks: {
      list: () => request<Webhook[]>("GET", "/webhooks"),
      create: (req) => request<Webhook>("POST", "/webhooks", { body: req }),
      remove: (id) => request<void>("DELETE", `/webhooks/${id}`),
    },
    taxonomies: {
      list: () => request<Taxonomy[]>("GET", "/taxonomies"),
      get: (key) => request<TaxonomyDetail>("GET", `/taxonomies/${encodeURIComponent(key)}`),
      upsertTerm: (key, term) =>
        request<Term>("POST", `/taxonomies/${encodeURIComponent(key)}/terms`, { body: term }),
      deleteTerm: (key, termId) =>
        request<void>("DELETE", `/taxonomies/${encodeURIComponent(key)}/terms/${encodeURIComponent(termId)}`),
      entryTerms: (entryId) => request<TermRef[]>("GET", `/entries/${entryId}/terms`),
      setEntryTerms: (entryId, termIds) =>
        request<TermRef[]>("PUT", `/entries/${entryId}/terms`, { body: { termIds } }),
    },
    builder: {
      manifest: () => request<BlockManifest>("GET", "/builder/manifest"),
      create: (root, entryId) => request<BuilderDocument>("POST", "/builder/documents", { body: { root, entryId } }),
      getDocument: (id) => request<BuilderDocument>("GET", `/builder/documents/${id}`),
      saveDocument: (id, doc) => request<void>("PUT", `/builder/documents/${id}`, { body: doc }),
      publish: (id) => request<void>("POST", `/builder/documents/${id}/publish`),
      revisions: (id) => request<BuilderRevision[]>("GET", `/builder/documents/${id}/revisions`),
      restore: (id, revisionId) => request<BuilderDocument>("POST", `/builder/documents/${id}/restore/${revisionId}`),
    },
    preview: {
      createToken: (documentId) => request<{ token: string }>("POST", "/preview/token", { body: { documentId } }),
      getBuilderDocument: (id, token) =>
        request<BuilderDocument>("GET", `/preview/builder/documents/${id}`, { query: { token } }),
    },
    audit: {
      list: (q) =>
        request<Paginated<AuditLogEntry>>("GET", "/audit", {
          query: {
            page: q?.page,
            pageSize: q?.pageSize,
            entityType: q?.entityType,
            entityId: q?.entityId,
          },
        }),
    },
    public: {
      async getPageBySlug(slug) {
        try {
          return await request<Entry>("GET", "/public/pages", { query: { slug } });
        } catch (err) {
          if ((err as { status?: number }).status === 404) return null;
          throw err;
        }
      },
      async getBuilderDocument(id) {
        try {
          return await request<BuilderDocument>("GET", `/public/builder/documents/${id}`);
        } catch (err) {
          if ((err as { status?: number }).status === 404) return null;
          throw err;
        }
      },
      getMenu: (location) => request<Menu>("GET", `/public/menus/${encodeURIComponent(location)}`),
      getSettings: (group) => request<SettingsGroup>("GET", `/public/settings/${encodeURIComponent(group)}`),
      getTaxonomy: (key) => request<TaxonomyDetail>("GET", `/public/taxonomies/${encodeURIComponent(key)}`),
    },
  };
}

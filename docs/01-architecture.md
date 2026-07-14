# 01 — Architecture, modules and deployment

## 1. Architectural style

**Modular monolith** (no microservices in the MVP). A single Node server (Fastify — see
[ADR-0001](adr/0001-fastify-vs-hono.md)) exposes the API; the panel is a React SPA; the
public site is an Astro app. Modularity lives in **packages** with explicit boundaries and
unidirectional dependencies, not in separate deployments.

Dependency rule (arrows indicate "may import from"):

```
apps/*  ──►  packages/*        (apps depend on packages, never the other way around)
cms-*   ──►  contracts, schemas, storage, ui, testing
builder-* ──► contracts, schemas, ui, testing        (NEVER imports cms-database or cms-core)
builder-* ──► cms-sdk          (the builder's only path to the CMS: public contract)
astro-*  ──► contracts, schemas, cms-sdk, builder-astro
contracts, schemas ──► (nothing; leaves with no domain dependencies)
```

**Coupling invariant:** `builder-*` cannot import from `cms-core`, `cms-database`,
or `cms-auth`. This is verified with a boundaries lint (`eslint-plugin-boundaries` /
`dependency-cruiser`) in CI. Any need of the builder with respect to the CMS goes through
`contracts` (types) or `cms-sdk` (runtime).

## 1.1 Infrastructure ports (hexagonal — [ADR-0008](adr/0008-infrastructure-agnostic.md))

The domain (`cms-core`, `builder-core`) only knows **interfaces**; concrete providers are
resolved in the **composition root** of `cms-server` and **injected**. With the default
adapters (the "0 infra" column) the platform starts up with nothing more than Postgres.

```
                       cms-server (composition root)
   env vars ──► resolves adapters ──► injects ports ──► cms-core / builder-core
                                                                 (does not import provider SDKs)

  StorageDriver  → fs | s3 | r2 | minio | gcs         (default: fs)
  CacheDriver    → memory | redis                     (default: memory)
  JobQueue       → in-process | pgboss | bullmq       (default: in-process)
  Mailer         → noop/log | smtp                    (default: noop)
  SecretsProvider→ env | vault | ssm                  (default: env)
  Logger         → stdout(json) | apm                 (default: stdout)
  AiProvider     → none | <plugin>                    (default: none, optional)
  Clock/Id       → standard (injectable in tests)
```

**Infra invariant:** the domain and the adapters are separated; `cms-core`/`builder-core` **do not**
import `@aws-sdk/*`, `ioredis`, or any provider SDK — only the adapters do. This is verified
in CI alongside the boundaries rule. Only mandatory backing service: **Postgres-compatible SQL**.

## 2. Module map

```
┌──────────────────────────────────────────────────────────────────────┐
│                              apps                                       │
│  cms-server      cms-admin      builder-app     astro-demo     docs     │
│  (Fastify API)   (React SPA)    (React, mounts  (site+preview)         │
│                                  builder-react)                         │
└───────┬───────────────┬──────────────┬───────────────┬────────────────┘
        │               │              │               │
┌───────▼───────────────▼──────────────▼───────────────▼────────────────┐
│                            packages                                     │
│                                                                         │
│  CMS                    BUILDER                 INTEGRATION / SHARED    │
│  ├ cms-core             ├ builder-core          ├ contracts (types+Zod) │
│  ├ cms-database         ├ builder-react         ├ schemas (fields)      │
│  ├ cms-auth             ├ builder-astro         ├ storage (files)       │
│  ├ cms-sdk (client)     ├ builder-sdk           ├ ui (design system)    │
│  ├ cms-astro (SDK+SSR)  ├ builder-default-blocks├ testing (utils)      │
│                         └ builder adapters                              │
└─────────────────────────────────────────────────────────────────────── ┘
```

### Responsibility by package

| Package                  | Responsibility | Depends on |
|--------------------------|-----------------|------------|
| `contracts`              | Public types and interfaces + Zod schemas for the API, documents, iframe messages. **Single source of truth for types.** | — |
| `schemas`                | Field system (`text`, `media`, `repeater`…): type → Zod + TS + defaults + form metadata. | contracts |
| `storage`               | `StorageDriver` interface + fs / S3 / R2 / MinIO drivers. | — |
| `ui`                     | React design system for the panel (accessible). | — |
| `testing`                | Fixtures, factories, test DB helpers. | contracts, cms-database |
| `cms-core`               | CMS use cases (pages, entries, revisions, publishing, menus, SEO, media, webhooks). No HTTP. | contracts, schemas, cms-database, storage |
| `cms-database`           | Drizzle schema, migrations, repos. | contracts |
| `cms-auth`               | Sessions, hashing, CSRF, RBAC. | contracts, cms-database |
| `cms-sdk`                | Typed TS client for the API v1 (browser + Node). | contracts |
| `cms-astro`              | Astro integration: SSR helpers, `getPage`, manifest loader, preview route. | contracts, cms-sdk |
| `builder-core`           | Document model, commands, undo/redo, validation, migrations, selection. **Framework-agnostic.** | contracts, schemas |
| `builder-react`          | Builder UI (canvas, tree, inspector, dnd) on top of `builder-core`. | builder-core, ui, contracts |
| `builder-astro`          | Block-rendering runtime in Astro + `data-builder-*` injection. | contracts, schemas |
| `builder-sdk`            | `createBuilderClient({ adapter })`, `BuilderStorageAdapter` interface. | contracts |
| `builder-default-blocks` | The 10 base blocks (definition + reference Astro components). | schemas, builder-astro |
| adapters                 | `cmsBuilderAdapter`, `inMemoryAdapter`, `jsonFileAdapter`. | builder-sdk, cms-sdk |

## 3. Deployment diagram (MVP, single-site)

```
                         ┌─────────────────────────────┐
   Client (editor) ─────►│  cms-admin (static SPA)      │
                         │  served by cms-server         │
                         └──────────────┬──────────────┘
                                        │  fetch  /api/v1/* (session cookie)
                                        ▼
   ┌───────────────────────────────────────────────────────────────┐
   │                     cms-server  (Node / Fastify)               │
   │  /api/v1/admin/*   Admin API (session + RBAC)                  │
   │  /api/v1/public/*  Public API (published only)                 │
   │  /api/v1/preview/* Preview API (token/session)                 │
   │  /api/v1/builder/* documents + manifest                        │
   │  /api/v1/webhooks  webhook dispatch                            │
   └───────┬───────────────────────┬───────────────────────────────┘
           │ Drizzle               │ StorageDriver
           ▼                       ▼
   ┌──────────────┐        ┌──────────────────────┐
   │ PostgreSQL   │        │ Object storage        │
   │ (source of   │        │ fs / S3 / R2 / MinIO  │
   │  truth)      │        │ (originals+variants)  │
   └──────────────┘        └──────────────────────┘

           ▲ HTTP (cms-sdk / rebuild or revalidation webhooks)
           │
   ┌───────┴───────────────────────────────────────────────────────┐
   │                 astro-demo  (Node SSR, see ADR-0002)           │
   │  /*                       public pages (published only)         │
   │  /__builder/preview/:id   draft render (token auth)             │
   │  data-builder-node-id / data-builder-type on each block         │
   └────────────────────────────────────────────────────────────────┘
                                        ▲
                                        │ iframe + postMessage
   ┌────────────────────────────────────┴──────────────────────────┐
   │  builder-app (inside /admin/builder/...)                       │
   │  Canvas = iframe → /__builder/preview/:id                      │
   └────────────────────────────────────────────────────────────────┘
```

Containers in `docker-compose.yml`: `postgres`, `minio` (S3 dev), `cms-server`,
`astro-demo`. `cms-admin` and `builder-app` are compiled to static assets served by `cms-server`
(or by Astro/CDN) — no dedicated container needed in the MVP.

## 4. Key flows

### 4.1 Publishing a page with the builder
1. Editor opens `/admin/builder/pages/:pageId` → `builder-app` mounts `builder-react`.
2. `builder-sdk` (with `cmsBuilderAdapter`) does `GET /api/v1/builder/documents/:docId` (draft).
3. The canvas loads the iframe `/__builder/preview/:docId?token=…`. Astro renders the draft.
4. Editing → commands in `builder-core` mutate the in-memory document (local undo/redo).
5. On hover/select/change, `builder-react` ⇄ iframe via `postMessage` (typed protocol).
6. "Save" → `PUT /api/v1/builder/documents/:docId` (persists the draft + creates a `builder_document_version`).
7. "Publish" → `POST /api/v1/pages/:pageId/publish`: validates the document, freezes the published version,
   fires webhooks (revalidation/rebuild), audit log.
8. The public URL serves the published version rendered by Astro.

### 4.2 Page without the builder (rich text)
Same as above but `editorType: "rich-text"`; the content lives in a `richText` field of the entry,
with no `builder_document`. Confirms the CMS does not depend on the builder.

## 5. Module diagram (dependencies, summary)

```
contracts ◄── schemas ◄── cms-core ◄── cms-server
    ▲            ▲            ▲
    │            │            └── cms-auth, cms-database, storage
    │            │
    │            └── builder-core ◄── builder-react ◄── builder-app
    │                     ▲                                  │
    │                     └── builder-astro ◄── astro-demo   │
    │                                                        │
    └── cms-sdk ◄── builder-sdk/adapters ◄──────────────────┘
```
No arrow enters `cms-database`/`cms-core`/`cms-auth` from `builder-*`. ✔ boundaries invariant.

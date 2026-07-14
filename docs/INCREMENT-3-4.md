# Increments 3 and 4 — Builder connected to the CMS and rendered by Astro

Connect product 1 (CMS) and product 2 (builder), and make **Astro render builder documents**.
Verified with integration (real Postgres) and SSR (curl).

## Increment 3 — Builder persistence in the CMS

| Layer | Content |
|------|-----------|
| `cms-database` | `builder_documents` + `builder_document_versions` tables (migration `0001`) |
| `cms-core` | `builder-service`: create, get, saveDraft (new version), publish, revisions, restore, getPublished |
| `cms-server` | `/api/v1/builder/documents` (POST/GET/PUT/publish/revisions/restore) with Zod + RBAC (`pages.*`) |
| `cms-sdk` | `cms.builder.*` (create/get/save/publish/revisions/restore) |
| `builder-adapters` | `cmsBuilderAdapter(cms)` — `BuilderStorageAdapter` over the SDK |

**End-to-end integration test** (against Postgres): `engine → cmsBuilderAdapter → cms-sdk →
API → cms-core → DB`. Creates a document, edits it with the `builder-core` **engine**, saves a draft
(new version), publishes, and restores v1. Proves that the builder operates the CMS **only through public
contracts**, never touching its tables directly.

## Increment 4 — Block renderer in Astro

| Layer | Content |
|------|-----------|
| `astro-demo` | `BlockRenderer.astro` (recursive), `registry.ts` (type→component), `Page/Hero/Heading/Paragraph/Section/Button` blocks |
| `cms-server` | `GET /api/v1/public/builder/documents/:id` (published only) |
| `cms-sdk` | `cms.public.getBuilderDocument(id)` |
| Route | `/b/:id` — SSR that renders the published tree |

**SSR verification:** created a `core/page → [hero, paragraph]` document, published it and served it at
`/b/:id`; Astro renders `<h1>Hello Builder</h1>` + description + paragraph from the JSON. Full chain
**JSON document → published → public API → recursive renderer → HTML**. In preview mode
the renderer injects `data-builder-node-id/type` (foundation of the iframe protocol).

## Overall status

- **35 passing tests** (contracts 4, cms-auth 2, cms-core 4, cms-sdk 3, schemas 3, builder-core 8,
  builder-adapters 3, cms-server 8) + strict typecheck across 11 projects + browser (panel) and SSR (Astro) verification.
- Both products exist and are **connected via contracts/SDK/adapters**, as the design requires.

## Pending for the full success criterion

`builder-react` (canvas + iframe + tree + inspector + dnd + inline editing + undo/redo UI),
preview route with **token** + `postMessage` wiring, integrating the builder as an editor for a
page (entry `editorType:'builder'` ↔ document), media library (Sharp), menus/SEO/settings in the
panel, webhooks, manifest endpoint, CLI/MCP (AI-native), and the **Playwright e2e** for the 18 steps.

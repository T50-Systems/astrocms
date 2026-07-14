# 00 — Overview, assumptions and scope

> Platform: **AstroCMS** (working name). Two conceptually separate products —
> a **self-hostable CMS for Astro** and a **WYSIWYG visual builder for Astro blocks** —
> integrated via public contracts, SDK, and adapters.

## 1. Problem overview

I build sites with Astro and need to give each client a comfortable panel (`/admin`)
to manage **pages, content, images, menus, and SEO without touching code, Git, or a terminal**.

I don't want a generic headless CMS (like Strapi). I want a reusable platform that
works like **WordPress core** for Astro projects, with an **optional builder**
(equivalent to Elementor) to lay out pages visually using **registered Astro components**.

Guiding analogy:

| Piece                        | WordPress equivalent |
|------------------------------|-----------------------|
| CMS                          | WordPress core   |
| Builder                      | Elementor             |
| Astro project               | Theme + public frontend |
| Registered Astro components | Widgets / blocks     |

## 2. Assumptions

- **S1.** Installation **per client** (single-site). Decisions that would block future multisite are avoided, but multitenancy is not implemented.
- **S2.** The technical operator (me) deploys and configures; the client only edits content.
- **S3.** Node.js ≥ 20 available in the deployment environment (VPS, container). Not an edge-only environment.
- **S4.** PostgreSQL as the production database; SQLite allowed in dev **only** if it doesn't diverge (see ADR-0006).
- **S5.** The Astro project and the CMS are deployed together or coordinated; they share `contracts`/`schemas`.
- **S6.** The client trusts the blocks I register; they **cannot** introduce arbitrary JS/CSS.
- **S7.** Moderate volume: dozens of pages, thousands of assets, few concurrent editors. No real-time collaboration.
- **S8.** The builder is **optional**: the CMS is fully functional without it (rich-text / markdown editor / fields).

## 3. Scope (MVP)

**CMS:** installation, login, sessions (HTTP-only cookie), users, `admin`/`editor` roles,
pages, entries, basic content types system, custom fields, rich text (Tiptap),
media library (Sharp + abstract storage), menus, basic SEO, global settings,
drafts, publishing, persistent revisions, preview, REST API v1, webhooks, React admin panel,
Astro integration via SDK.

**Builder:** canvas with an iframe of the real Astro site, block panel, node tree, inspector,
drag-and-drop, reorder, duplicate, delete, hide/show, inline text editing,
local undo/redo, responsive preview via tokens, media picker (from the CMS), save draft,
publish via CMS, document validation, **10 base blocks** + per-project blocks.

**Astro:** recursive document renderer, preview route (`/__builder/preview/:id`),
block registry, serializable manifest, CMS integration, demo theme, working demo project.

## 4. Out of scope (explicit)

Marketplace, e-commerce, multisite, full multitenancy, comments, real-time
collaboration, installing plugins from the panel, free-form CSS, custom JavaScript,
complex animations, absolute positioning, client-customizable breakpoints,
mobile app, GraphQL, multiple frontend frameworks, full theme editing in the browser,
managed hosting, billing, advanced analytics.

## 5. Architecture principles (invariants)

1. **Astro is the renderer** of the public frontend. The CMS/builder never render the site's final HTML.
2. **The CMS is the source of truth**: content, users, permissions, media, pages, revisions, publishing.
3. **The builder only manages the document's visual structure** (JSON tree).
4. **Visual content = structured JSON**, never arbitrary HTML.
5. **Astro components are registered via declarative schemas**; the component's code **never** travels to the panel.
6. The client **does not** modify arbitrary JS/CSS; only content, variants, order, visibility, and allowed props.
7. **Controlled blocks** over a fully free page builder.
8. The CMS **works without the builder**; the builder **works with other backends** via adapters.
9. **APIs and documents are versioned**; blocks support **schema migrations**.
10. **Strong typing end-to-end**; shared contracts, no duplicated front/back schemas.
11. **Infrastructure-agnostic via ports and adapters.** Everything touching infrastructure (storage, cache,
    queue, mail, secrets, observability) goes through an interface with a default adapter that has
    **zero external dependencies**. The only mandatory backing service is **a Postgres-compatible
    SQL database** (self-hosted or managed). See [ADR-0008](adr/0008-infrastructure-agnostic.md).
12. **Designed to be operated by AI, safe by construction.** The tool is *readable and
    manipulable by AI agents* (deterministic conventions, declarative schemas, machine-readable
    manifests and OpenAPI, CLI + codegen + MCP server, `AGENTS.md`). Any AI —whether build-time or
    editing-time— acts through the **same typed, validated, and versioned contracts** as a human;
    **never** a privileged path nor free-form JS/CSS/HTML. See [ADR-0009](adr/0009-ai-native-safe-operations.md)
    and [12-ai-native](12-ai-native.md).

## 6. Boundaries that are never crossed

- The builder **does not** implement: users, login, global roles, its own database, its own media,
  its own publishing, general page management, its own persistent revisions. All of that is consumed from the CMS via SDK.
- The panel/builder **never** receives Astro component code, only the **manifest** (schema + metadata).
- The public frontend **never** serves unpublished content without an authorized preview token.

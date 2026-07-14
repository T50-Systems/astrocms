# AstroCMS — Design documentation (Phase 0)

Definition deliverables prior to implementation. Suggested reading order:

| # | Document | Contents |
|---|-----------|-----------|
| 00 | [Overview and scope](00-overview.md) | Problem, assumptions, scope, out-of-scope, principles |
| 01 | [Architecture](01-architecture.md) | Style, module map, deployment, flows, boundaries |
| 02 | [Data model](02-data-model.md) | PostgreSQL tables, ER, modeling decisions |
| 03 | [CMS contracts](03-contracts-cms.md) | TS types + SDK + API v1 map |
| 04 | [Builder contracts](04-contracts-builder.md) | Document, manifest, commands, adapter |
| 05 | [Iframe protocol](05-iframe-protocol.md) | Typed postMessage messages + security |
| 06 | [Block registry](06-block-registry.md) | `defineBlock`, field system, manifest, renderer |
| 07 | [Monorepo structure](07-monorepo-structure.md) | Packages, names, conventions |
| 08 | [Roadmap](08-roadmap.md) | Phases 0–7 and initial vertical increment |
| 09 | [Backlog](09-backlog.md) | Prioritized epics and issues |
| 10 | [Acceptance criteria](10-acceptance-criteria.md) | Success criteria + DoD |
| 11 | [Risks and threats](11-risks.md) | Risks, STRIDE, security checklist |
| 12 | [AI-native and ease of use](12-ai-native.md) | Dev+AI (CLI/MCP/AGENTS.md), client+AI, client without AI |

## ADRs

| ADR | Decision |
|-----|----------|
| [0001](adr/0001-fastify-vs-hono.md) | Backend: **Fastify** (vs Hono) |
| [0002](adr/0002-astro-rendering-strategy.md) | Astro: **hybrid on-demand SSR** by default |
| [0003](adr/0003-modular-monolith.md) | Modular monolith with verified boundaries |
| [0004](adr/0004-document-json-model.md) | Visual content as a versioned JSON tree |
| [0005](adr/0005-single-site-not-multitenant.md) | Single-site, multisite-ready |
| [0006](adr/0006-postgres-primary-sqlite-tests.md) | Postgres primary; SQLite only for pure tests |
| [0007](adr/0007-testing-strategy.md) | Testing strategy |
| [0008](adr/0008-infrastructure-agnostic.md) | **Infrastructure-agnostic** via ports and adapters |
| [0009](adr/0009-ai-native-safe-operations.md) | **AI operability** safe by construction |

## Implemented increments (log)

| Doc | Contents | Status |
|-----|-----------|--------|
| [INCREMENT-1](INCREMENT-1.md) | CMS slice: auth, pages, drafts, revisions, API, React admin panel, Astro SSR | ✅ verified |
| [INCREMENT-2](INCREMENT-2.md) | Builder base: schemas, builder-core (engine/undo-redo/validation/migrations), adapters | ✅ verified |
| [INCREMENT-3-4](INCREMENT-3-4.md) | Builder↔CMS (persistence+API+SDK+cmsAdapter) and Astro renderer | ✅ verified |
| [INCREMENT-media](INCREMENT-media.md) | Media library (storage+Sharp+multipart) — Codex-assisted | ✅ verified |
| [INCREMENT-5 (spec)](INCREMENT-5-builder-react-spec.md) | Visual builder `builder-react` — implemented (Codex) and browser-verified | ✅ verified |
| [INCREMENT-6 (spec)](INCREMENT-6-cli-mcp-spec.md) | CLI `astrocms` + MCP server (AI-native) | 🔄 in progress |
| Menus + Settings + SEO + Webhooks | Backend + admin + HMAC — Codex-assisted | ✅ verified |

**Current status:** ~51 passing tests, 13+ projects with strict typecheck. CMS + visual builder +
media + menus/settings/webhooks working end-to-end. Pending: CLI/MCP (in progress), Playwright e2e.

**Recent method:** delegating increments to **Codex** (gpt-5.5, write mode) + verification and
hardening by Claude (typecheck/tests against Postgres + browser testing). See correction notes
in each increment doc.

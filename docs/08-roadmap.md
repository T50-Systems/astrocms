# 08 — Roadmap by milestones

Work proceeds in phases; each phase ends in something runnable and demonstrable. Increments are
**vertical** (code + migration + types + validation + tests + docs + criteria + demo).

## Phase 0 — Definition ✅ (this deliverable)
Architecture, ADRs, module boundaries, contracts, data model, threats, testing strategy,
conventions. **Output:** `docs/*`, ADRs, configured monorepo root.

## Milestone 1 — CMS core (Phase 1)
DB (Drizzle + migrations + seed), auth (HTTP-only cookie sessions, hashing, CSRF, rate limit),
users, `admin`/`editor` roles, base content types, entries + `entry_versions`, drafts,
revisions, publishing, administrative and public API v1.
**Demo:** create/edit/publish a page via the API (curl/tests); revisions and restore work.

## Milestone 2 — Admin panel (Phase 2)
`cms-admin`: login, layout, listings (pages/entries), forms (RHF+Zod), media
(upload + Sharp + variants + picker), menus, SEO, settings. Loading/error/empty states. A11y.
**Demo:** an editor manages content and media from `/admin` without touching the API by hand.

## Milestone 3 — Astro integration (Phase 3)
`cms-sdk`, `cms-astro`, renderer, preview route, manifest, demo theme, public pages.
The public API only serves published content; preview requires a token.
**Demo:** the published page is visible at the public URL rendered by Astro; the draft is visible only with a token.

## Milestone 4 — Builder core (Phase 4)
`builder-core`: document model, commands, undo/redo, selection, validation, migrations;
`builder-sdk` + adapters (cms/inMemory/jsonFile). No UI yet.
**Demo:** tests that build/mutate/validate/migrate documents and perform deterministic undo/redo.

## Milestone 5 — Visual builder (Phase 5)
`builder-react`: canvas with iframe, block panel, tree, inspector, dnd (dnd-kit), inline
editing, token-based responsive behavior, media picker. Typed iframe protocol.
**Demo:** lay out a page by dragging blocks and editing props live, without persisting yet.

## Milestone 6 — Full integration (Phase 6)
Builder as the CMS editor; save draft, revisions, publish, permissions, preview, error
handling; e2e tests (Playwright) for the success criterion.
**Demo:** the complete 18-step success-criterion flow passes in e2e.

## Milestone 7 — Hardening (Phase 7)
Security (audit, session revocation, upload validation, signed URLs), performance
(cache, incremental preview patches), accessibility, migrations, documentation, installer,
polished Docker Compose, real-world example, second Astro project reusing the core.
**Demo:** success criterion #19 (reuse the core in a second project with different components).

## First vertical increment (starts after Phase 0)
A subset of Milestones 1+2+3 sufficient for an early demonstration:
- authentication (login/session/logout);
- page creation (`page` entry, draft);
- draft storage (`entry_versions`);
- minimal API v1;
- minimal panel (login + list + page form);
- basic Astro rendering of a published page;
- tests (unit + DB integration + one happy-path e2e).

This increment is the subject of the **second delivery** (next response), not of Phase 0.

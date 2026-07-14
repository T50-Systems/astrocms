# Vertical increment 2 — Builder foundation (product 2)

Foundation of the visual builder, **pure TS and framework-agnostic**, verified with unit tests
(no infra or browser). Covers Milestone 4 of the [roadmap](08-roadmap.md).

## What it includes

| Package | Content | Tests |
|---------|-----------|-------|
| `@astrocms/contracts` (+builder) | `BuilderDocument`/`BuilderNode`, `BlockManifest`, `BuilderCommand`, `ValidationResult`, and the **iframe protocol** (`Envelope` + Host/Guest messages) — all with Zod | — |
| `@astrocms/schemas` | Field system (text, textarea, richText, number, boolean, select, url, slug, media) → each generates Zod + default + serialize; `defineBlock`, `serializeBlock`, `buildManifest`, `DEFAULT_TOKENS` | 3 |
| `@astrocms/builder-core` | `createEngine`: dispatch of reversible commands, **deterministic undo/redo** (snapshots), selection, `clone` (new ids at depth), `validateDocument` (types/constraints/required fields), `migrateDocument` (per block version), immutable tree utilities | 8 |
| `@astrocms/builder-adapters` | `BuilderStorageAdapter` + `inMemory` (tests) and `jsonFile` (dev): load/saveDraft/publish/revisions/restore — **interchangeable** | 3 |

## Verified guarantees

- **The manifest does NOT contain `component`** (Astro code never travels to the panel) — explicit test.
- **Exact Undo→Redo round-trip** (JSON snapshot comparison).
- **Clone/duplicate regenerate ids** at depth (no collisions with the original).
- **A `locked` node cannot be deleted/moved**; structural locking respected.
- **Validation** detects unknown block, empty required field, disallowed children, min/max, invalid parent.
- **Migration** applies `from→to` chains per version; no route → node left intact (the preview will emit `schema-mismatch`).
- **Interchangeable adapters**: same interface, inMemory and jsonFile pass the same round-trip.

## Design (Architecture Advisor)

- **Document behavior:** JSON tree + reversible commands; history via snapshots
  (simple and deterministic; sufficient for a single editor, no premature CRDT/OT).
- **The command model is also the safe API for AI** (ADR-0009): every mutation — human or AI —
  goes through a validated `BuilderCommand`; no free HTML/CSS/JS.
- **Decoupling:** `builder-core` does not depend on React or the CMS; only on `contracts`. The adapters
  isolate the backend (portability, ADR-0008). Migrations are injected via a registry (not coupled to `schemas`).

## Pending for the builder (upcoming increments)

Document persistence in the CMS (`builder_documents(_versions)` tables + API + `cms-sdk.builder`),
`builder-react` (canvas/iframe/inspector/tree/dnd), `builder-astro` (renderer + `defineBuilderConfig` +
`data-builder-*`), preview route with token, `builder-default-blocks` (10 blocks), and the e2e of the
success criterion.

# Increment — Media library (Codex-assisted)

Implemented by Codex (gpt-5.5) and **verified/hardened** by Claude. Covers the media block
of Milestone 2. Verified against real Postgres.

## What it includes

| Layer | Content |
|------|-----------|
| `@astrocms/storage` (NEW) | `StorageDriver` (put/get/delete/exists/url) + **filesystem** driver with opaque keys (no path traversal). Infrastructure-agnostic (ADR-0008). 8 tests. |
| `contracts` | `MediaAsset`, `MediaVariant`, `MediaQuery` + Zod (`media.ts`) |
| `cms-database` | `media_assets` + `media_variants` tables (migration `0002_media_library.sql`) |
| `cms-core` | `media-service`: **real MIME validation via magic bytes**, size limit, **SHA-256 checksum**, **Sharp** variants (`thumb` 200w, `md` 800w, `webp`), persistence and deletion. Injects `StorageDriver` (port). |
| `cms-server` | `POST/GET /media`, `GET /media/:id`, `DELETE /media/:id`, and **public** `GET /media/file/:key`. Uploads with **@fastify/multipart** (streaming, size limit). RBAC `media.read/write/delete`. |
| `cms-sdk` | `cms.media.list/get/upload(File\|Blob)/remove` |

## Verification

- **45 passing tests** across the workspace (storage 8; cms-server 10, including 2 media tests: upload with
  variants+checksum, and **rejection of spoofed MIME**). Strict typecheck across 12 projects.
- Migration `0002` applied to Postgres; tables + indexes confirmed.

## Claude's fixes to Codex's deliverable

- Codex's sandbox **had no network access**: it left `node_modules` incomplete and could not verify. Fixed with
  `pnpm install` (sharp compiled with prebuilds).
- Added `drizzle-orm` to `cms-server`'s **devDependencies** (the media test queries the DB) — the
  production edge still does not import drizzle.
- **Replaced Codex's hand-rolled multipart parser** with **@fastify/multipart** (more robust + real
  streaming size limit); removed `apps/cms-server/src/multipart.ts`.
- File serving made **public** (opaque key) so images on published pages load without a session. Private
  media / signed URLs → hardening (Phase 7).

## Method (lean-on-Codex)

Codex implemented the bulk of it with gpt-5.5 in write mode (yolo); Claude fixed the environment, corrected
the typecheck, hardened security (multipart, public access) and **actually verified** it (typecheck + tests
against Postgres) before signing off on the increment. Pattern: *Codex writes → Claude verifies and hardens*.

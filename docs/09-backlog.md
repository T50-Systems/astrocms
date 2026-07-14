# 09 — Initial backlog (issue format)

Priority: **P0** = blocks the success criterion · **P1** = MVP · **P2** = hardening.
Format: `#ID [Area][Prio] Title — summarized acceptance criterion`.

## Epic A — Monorepo foundations
- `#A1 [Infra][P0]` pnpm + Turbo monorepo + strict tsconfig + ESLint/Prettier — `pnpm i && pnpm typecheck` green.
- `#A2 [Infra][P0]` Boundaries rule (dependency-cruiser): `builder-*` does not import `cms-core/database/auth` — CI fails on violation.
- `#A3 [Infra][P0]` Docker Compose: postgres + minio up with `docker compose up` — health checks OK.
- `#A4 [Infra][P1]` `.env.example`, seeds, `/healthz` health check — documented in README.

## Epic B — Contracts and schemas
- `#B1 [Contracts][P0]` `@astrocms/contracts`: types + Zod for API, document, manifest, iframe messages — `pnpm typecheck` and Zod round-trip tests.
- `#B2 [Schemas][P0]` Base field descriptors (text, richText, media, select, number, boolean) — each generates Zod+default+serialize; tests.
- `#B3 [Schemas][P1]` Remaining fields (repeater, object, blocks, relation, taxonomy, gallery, tokens…) — tests per field.

## Epic C — Database and auth (Milestone 1)
- `#C1 [DB][P0]` Drizzle schema + initial migration for all tables in [02-data-model] — reproducible `db:migrate`.
- `#C2 [DB][P0]` Dev seed (site, admin, editor, roles/permissions, page/post content types) — idempotent.
- `#C3 [Auth][P0]` Hashing (argon2/bcrypt), login, HTTP-only cookie session, logout, `/me` — integration tests.
- `#C4 [Auth][P0]` CSRF (double-submit) + rate limit on `/auth/login` — rejection tests.
- `#C5 [Auth][P1]` RBAC: permission middleware, revocable sessions — editor cannot access `users.manage`.

## Epic D — Content (Milestone 1)
- `#D1 [Content][P0]` Entry CRUD + unique slug + states — tests.
- `#D2 [Content][P0]` Versioning: every save creates an `entry_version`; `current`/`published` — tests.
- `#D3 [Content][P0]` Publish/unpublish + audit — publishing ≠ overwriting the draft.
- `#D4 [Content][P1]` Revisions: list, compare (diff), restore — restore creates a new version.
- `#D5 [Content][P1]` Per-entry SEO (SeoMeta) + validation — the API persists/returns it.
- `#D6 [Content][P1]` Webhooks: register + trigger on publish with HMAC — `webhook_deliveries` logs the attempt.

## Epic E — API (Milestone 1/3)
- `#E1 [API][P0]` Admin v1 routes (pages, media, menus, settings) with Zod validation — 400 on invalid payload.
- `#E2 [API][P0]` Public API (`/public/*`), published content only, no auth — drafts not visible.
- `#E3 [API][P0]` Preview API (`/preview/*`) with signed token — 401 without a token.
- `#E4 [API][P1]` OpenAPI generated from Zod (`@fastify/swagger`) — `/docs` serves the spec.

## Epic F — Media (Milestone 2)
- `#F1 [Media][P0]` `StorageDriver` fs + s3/minio — upload/read/delete; tests with minio.
- `#F2 [Media][P0]` Upload with real MIME validation + limits + checksum + Sharp variants — rejects spoofed MIME.
- `#F3 [Media][P1]` Signed URLs when the driver requires them — they expire.

## Epic G — Admin panel (Milestone 2)
- `#G1 [Admin][P0]` Shell: login, router (TanStack), query, layout, auth guard — redirects without a session.
- `#G2 [Admin][P0]` Page list + form (RHF+Zod) with loading/error/empty states — basic a11y.
- `#G3 [Admin][P1]` Media library + reusable picker — used by the form and the builder.
- `#G4 [Admin][P1]` Menus, SEO, settings, users (admin) — editor cannot see users.

## Epic H — Astro integration (Milestone 3)
- `#H1 [Astro][P0]` `cms-astro`: `getPage`/`getEntry` SSR + SSR config (ADR-0002) — published page renders.
- `#H2 [Astro][P0]` Recursive document renderer + `registry.generated` — tree → HTML.
- `#H3 [Astro][P0]` `/__builder/preview/:id` route with token + `data-builder-*` — draft visible with token.
- `#H4 [Astro][P1]` Demo theme (`defineTheme`) + public pages + 404 — browsable demo.

## Epic I — Builder core (Milestone 4)
- `#I1 [Builder][P0]` Document model + validation against the manifest — tests.
- `#I2 [Builder][P0]` Commands + deterministic undo/redo — property tests.
- `#I3 [Builder][P0]` Block migrations (`version` per node) — old documents migrate on load.
- `#I4 [Builder][P0]` `BuilderStorageAdapter` + inMemory/jsonFile/cms — interchangeable in tests.

## Epic J — Visual builder (Milestone 5)
- `#J1 [Builder][P0]` iframe canvas + typed postMessage protocol + origin validation — handshake OK.
- `#J2 [Builder][P0]` Block panel + node tree + synchronized selection — canvas click ↔ tree.
- `#J3 [Builder][P0]` Inspector (forms from the manifest) + `setProp` — changes a prop live.
- `#J4 [Builder][P0]` dnd-kit: insert/reorder/move with constraints — respects allowed parents/children.
- `#J5 [Builder][P0]` Inline editing → `guest/inline-edit` → `setProp` (no HTML is saved) — the document is the source of truth.
- `#J6 [Builder][P1]` Duplicate/hide/delete + per-breakpoint responsive behavior + patterns/templates — capabilities respected.

## Epic K — Full integration (Milestone 6)
- `#K1 [E2E][P0]` Builder as the CMS editor: load/save draft/publish via adapter — persists.
- `#K2 [E2E][P0]` Permissions + preview + errors (schema-mismatch, preview-error) — banner shown, nothing breaks.
- `#K3 [E2E][P0]` Playwright: the 18 steps of the success criterion — green in CI.

## Epic M — Infrastructure-agnostic (ADR-0008, cross-cutting)
- `#M1 [Infra][P0]` `CacheDriver`/`JobQueue`/`Mailer`/`SecretsProvider`/`Logger` ports with a default adapter (0 infra) + composition root that injects from env — starts with only Postgres.
- `#M2 [Infra][P0]` `StorageDriver` fs + s3/minio behind the port; the domain does not import provider SDKs — boundaries rule in CI.
- `#M3 [Infra][P1]` OCI image + reproducible `docker-compose`; no proprietary APIs — runs on VPS/PaaS/k8s with just env vars.
- `#M4 [Infra][P2]` Optional adapters (redis, pgboss, smtp) + per-provider deployment docs.

## Epic N — AI-native and ease of use (ADR-0009)
- `#N1 [DX][P1]` `astrocms` CLI (`generate block`, `add content-type`, `generate types`, `validate`, `manifest --json`), idempotent, JSON output, actionable errors.
- `#N2 [DX][P1]` `AGENTS.md` generated by the installer with conventions/commands/boundaries.
- `#N3 [DX][P1]` OpenAPI + JSON Schemas + `BlockManifest` exposed (`/openapi.json`, `/builder/manifest`) — self-describing system.
- `#N4 [AI][P2]` `@astrocms/mcp` MCP server with typed tools (introspection + validated operations + RBAC).
- `#N5 [AI][P2]` `AiProvider` port + optional `aiAssistantPlugin()`: NL→`BuilderCommand[]` with preview/confirmation; text/SEO/alt helpers. Provider-agnostic; can be disabled.
- `#N6 [AI][P2]` Contract tests: invalid AI operations are rejected the same way as a human's would be.
- `#N7 [UX][P1]` Page templates + patterns + guided empty states + jargon-free copy (ease of use without depending on AI).

## Epic L — Hardening (Milestone 7)
- `#L1 [Sec][P2]` Full audit, session revocation, rich text sanitization, path traversal — security tests.
- `#L2 [Perf][P2]` Manifest/public cache + incremental preview patches — measured.
- `#L3 [Docs][P2]` Installer + "new Astro project" guide + second demo (criterion #19).

# 11 — Technical risks, threats and mitigations

## 1. Technical risks

| ID | Risk | Impact | Prob. | Mitigation |
|----|--------|---------|-------|-----------|
| R1 | **Preview fidelity**: the iframe re-renders via Astro SSR on every structural change → latency. | High | Medium | Debounce + `host/node-props-updated` for prop changes (targeted patch); full re-render only on structural changes; incremental patches in Phase 7. |
| R2 | **Schema drift** between the project's blocks and saved documents. | High | Medium | Per-node `version` + mandatory migrations; `schema-mismatch` doesn't break the rest; test that migrates fixture documents. |
| R3 | **builder→CMS coupling** leaking outside the adapter. | High | Medium | Boundaries rule in CI (`dependency-cruiser`); the builder only knows about `BuilderStorageAdapter` + `BlockManifest`. |
| R4 | **Monorepo complexity** slows down startup. | Medium | Medium | Vertical increments; packages created as they're implemented; Turbo cache. |
| R5 | **SQLite/Postgres divergence** if SQLite is used in dev. | Medium | Medium | Postgres by default in dev via Docker; SQLite only for pure unit tests (ADR-0006). |
| R6 | **Large-tree performance** in the builder (documents with many nodes). | Medium | Low | Immutable structures + selection by id; tree virtualization if needed. |
| R7 | **Manifest out of sync** between Astro (build) and the CMS (runtime). | Medium | Medium | Manifest served by the CMS but generated at Astro build time and published to the CMS; versioning + hash; validation when the builder loads. |
| R8 | **Undo/redo inconsistency** with future collaborative editing. | Low | Low | Single-editor MVP; serializable commands prepare for a future OT/CRDT without compromising now. |
| R9 | **Client-side blocking** from block errors in public production. | High | Low | Tolerant renderer: an unknown/erroring block is skipped with a placeholder; the whole page never breaks. |

## 2. Threat model (STRIDE summary)

**Surfaces:** admin API, public API, preview API, `postMessage` iframe channel, uploads,
rich text rendering, file serving.

| Threat | Vector | Mitigation |
|---------|--------|-----------|
| **Spoofing** | Impersonating a session / the iframe's origin | HTTP-only + `SameSite` cookies; `origin` and `channelId` validation in postMessage; signed preview token with expiration. |
| **Tampering** | Modifying payloads / documents | Strict Zod validation on all input; HMAC on webhooks; immutable versions. |
| **Repudiation** | Denying actions | `audit_log` with actor, before/after, IP. |
| **Information disclosure** | Viewing drafts/other sites | Public API serves published content only; preview requires a token; `site_id` on queries; no listing of other sites' assets. |
| **Denial of service** | Brute force / oversized uploads | Rate limiting on auth; size/MIME limits; timeouts; mandatory pagination. |
| **Elevation of privilege** | Editor performing admin tasks | Per-permission RBAC on every endpoint; the client is never trusted; negative tests. |

## 3. Security controls from day one (checklist)

- [ ] `HttpOnly; Secure; SameSite=Lax` cookies; DB-revocable sessions.
- [ ] CSRF (double-submit token) on admin API mutations.
- [ ] Rate limiting on `/auth/*`.
- [ ] Password hashing with argon2id (or bcrypt cost≥12).
- [ ] `origin` + `channelId` + explicit `targetOrigin` validation on the iframe.
- [ ] Uploads: **real MIME** validation (magic bytes), size limit, checksum, sanitized filenames.
- [ ] Rich text: store Tiptap JSON; sanitize on render (node/mark allowlist).
- [ ] Path traversal prevention in `storage` (opaque keys, no client-supplied paths).
- [ ] Signed URLs for private files when the driver requires them.
- [ ] Strict separation of public / admin / preview APIs.
- [ ] **No** executing code installed from the panel; **no** arbitrary JS/CSS; **no** untrusted dynamic imports.
- [ ] No secrets in the repo; `.env` excluded from version control.

## 4. Product / process risks

- **Early over-engineering** → mitigated by "no empty folders / no unused abstractions" and by vertical increments.
- **Builder scope creeping** toward a free-form page builder → limited by controlled tokens/blocks; free CSS/JS explicitly out of scope for the MVP.
- **Core updates breaking projects** → versioned API and documents; migrations; stable contracts.

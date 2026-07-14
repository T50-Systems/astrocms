# 10 — MVP acceptance criteria

## 1. Success criterion for the first release (full flow)

It must be possible, end to end, without touching Git/terminal/code as a client:

1. Create a sample Astro project. → `apps/astro-demo` starts.
2. Install the CMS. → `docker compose up` + `pnpm db:migrate && pnpm db:seed`.
3. Log in at `/admin`. → HTTP-only session cookie issued.
4. Create a page. → `entry` (kind page) in draft state.
5. Select the builder editor. → `editorType='builder'`, a `builder_document` is created.
6. Insert a Hero. → `site/hero` node in the tree.
7. Edit its title in the preview. → inline editing → `setProp props.title`.
8. Choose an image from the library. → `MediaRef { assetId }` in props.
9. Add a text section. → content node added.
10. Reorder the blocks. → `moveNode` respects constraints.
11. Save a draft. → `PUT /builder/documents/:id` + new version.
12. View the preview. → the iframe shows the draft with a token.
13. Publish. → `published_version_id` set, webhooks triggered.
14. Open the public URL. → Astro serves the published version.
15. See the page rendered by Astro. → tree HTML, no `data-builder-*`.
16. Restore a previous revision. → new version created from history.
17. Create an editor user. → `editor` role.
18. Restrict their permissions. → editor without `users.manage`/`settings.write`.
19. Reuse the same core in a second Astro project with different components. → only blocks/theme change.

Each step is covered by an e2e test (`#K3`).

## 2. Cross-cutting criteria (Definition of Done per increment)

An increment is considered done only if it includes **all** of the following:
- Code with **strict TS**, no unjustified `any`.
- Reproducible DB **migration** (if it touches data) + updated seed.
- **Types and validation** shared from `contracts` (no duplicated front/back Zod).
- **Tests:** domain unit tests, integration with a real DB (testcontainers/compose), and e2e if it touches the UI.
- **UI states:** loading, error and empty covered; validated forms; basic a11y (labels, focus, roles).
- **Explicit errors:** no silent failures; typed `ApiError` responses.
- **Structured logs** and a green `/healthz`.
- Increment-local **docs** + **commands to run it** + reproducible **demo**.
- **No secrets** in the repo.

## 3. Acceptance criteria by capability (samples)

**Auth**
- Valid login → 200 + `Secure; HttpOnly; SameSite=Lax` cookie. Invalid → 401 without revealing whether the email exists.
- 5 failed attempts/min from one IP → 429 (rate limit).
- Logout → session revoked; subsequent `/me` → 401.

**Content and publishing**
- Publishing does not alter the working draft; `published_version` and `current_version` coexist.
- The public API never returns unpublished entries (negative test).
- Restoring revision N creates version N+1 (history is not overwritten).

**Builder**
- A document with a block at a lower `version` migrates on load; if there is no migration path → `schema-mismatch`, the rest remains editable.
- `undo` followed by `redo` recovers the exact state (property test).
- Constraints: dropping a `Column` outside `Columns` is rejected on drop.
- Inline editing never persists `contenteditable` HTML; only `{nodeId, path, value}`.

**iframe channel security**
- A message with an `origin` different from `PREVIEW_ORIGIN` → discarded (test).
- Preview without a valid token → 401; expired token → 401.

**Media**
- A file with an image extension but a different real MIME type → rejected.
- Declared Sharp variants are generated; the original keeps its checksum.

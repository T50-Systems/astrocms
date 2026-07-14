# Increment 5 (spec) — builder-react: visual builder UI

Specification for implementing the visual editor (product 2, React layer) on top of `builder-core`.
Runs **after** the media increment to avoid `pnpm install` conflicts.

## Goal

`@astrocms/builder-react` + a route in `cms-admin` that mounts the builder for a page with
`editorType: "builder"`. Minimal but functional UI for Milestone 5, on top of the existing engine.

## Scope

1. **`packages/builder-react`** (new, React 18):
   - `<BuilderProvider>` that creates/exposes a `BuilderEngine` (from `@astrocms/builder-core`) via context + a `useBuilder()` hook that subscribes to `engine.subscribe` (with `useSyncExternalStore`).
   - **Block panel**: lists `manifest.blocks` by category; clicking/dragging inserts a node (manifest defaults) into the selected node or the root.
   - **Node tree**: recursive render of the document; click selects (`engine.select`); highlights `selectedNodeId`; duplicate/hide/delete buttons according to `capabilities`.
   - **Inspector**: form generated from `manifest.blocks[type].fields` (text/textarea/number/boolean/select/media) that dispatches `engine.dispatch({kind:'setProp', nodeId, path:'props.<key>', value})`. Media uses a picker that calls `cms.media.list()` (from the SDK, already available after the media increment).
   - **Toolbar**: undo/redo (`engine.undo/redo`, disabled via `canUndo/canRedo`), save (callback), publish (callback), breakpoint selector (`manifest.tokens.breakpoints`).
   - **Canvas with iframe**: loads `PREVIEW_ORIGIN` + the document's preview route; implements the **host** side of the `@astrocms/contracts` `postMessage` protocol (`envelopeSchema`, `hostMessageSchema`, `guestMessageSchema`): validates `origin` + `channelId`; sends `host/document-updated`/`host/select-node`; receives `guest/node-selected`/`guest/inline-edit` (→ `setProp`)/`guest/preview-ready`. Uses `EnvelopeSchema` for validation.
   - dnd with **dnd-kit** to reorder within the tree (minimum: reorder children of a container → `moveNode`, respecting `canInsert`).
   - No free-form CSS; the panel has its own styles.
2. **`apps/astro-demo`**: **preview** route `/__builder/preview/[id]` (SSR) that renders the (draft) document with `BlockRenderer` in `preview` mode (injects `data-builder-*`) and includes the protocol's **guest** script (validates `ADMIN_ORIGIN` + `channelId`; emits `guest/preview-ready` and `guest/node-selected` on click over `[data-builder-node-id]`; applies `host/*`). Authorized with a signed **preview token** (new endpoint in cms-server: `POST /api/v1/preview/token` → short-lived token; the guest receives it via querystring and the CMS validates it at a `GET /api/v1/preview/builder/documents/:id?token=` endpoint).
3. **`apps/cms-admin`**: `/pages/$pageId/builder` route that, if the page is `editorType:'builder'`, loads the document (creates one if missing), mounts `builder-react` with `cmsBuilderAdapter`, and wires save/publish to the CMS.
4. **Entry↔document integration**: when a page is switched to `editorType:'builder'`, `cms-core` creates a `builder_document` and stores its id in `entry_versions.builderDocumentId`; the `entry` references it. Endpoint/service for this.

## Conventions (identical to the rest of the repo)

- No file > 500 LOC (split components). Strict TS, no unjustified `any`.
- `@astrocms/builder-react` package: `exports` → `./src/index.ts`; deps `@astrocms/builder-core`, `@astrocms/contracts`, `@astrocms/cms-sdk`, `@astrocms/builder-adapters`, `react`, `@dnd-kit/*`, `zod`.
- Do not commit.

## Verification

- `pnpm -r typecheck` passing.
- `astro check` in `astro-demo` passing.
- `vite build` of `cms-admin` passing.
- Browser test (preview MCP): open the builder route, insert a Hero, edit the title in the inspector, see the change in the iframe, save and publish; check `/b/:id` or `/__builder/preview/:id`.
- Ideally, a test of the `postMessage` protocol (origin/channelId validation with `envelopeSchema`).

## Notes

- The protocol, commands, and manifest ALREADY exist in `@astrocms/contracts` and `@astrocms/builder-core`; this layer is **UI + wiring**, not new domain logic.
- Inline editing and incremental preview re-rendering can start with the simple path: on structural changes, `host/document-updated` → the guest re-fetches/re-renders the draft.

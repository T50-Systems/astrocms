# 05 — iframe communication protocol (postMessage)

The builder canvas is an `iframe` that loads the **real Astro project** in preview mode:

```
/pages/:pageId/builder   (builder-react, "host")
        └── iframe ──►  /builder-preview/:documentId?channelId=…&token=…   (astro, "guest")
```

> **Implementation note:** the preview route is `/builder-preview/:id`, **not** `/__builder/preview/`.
> Astro **excludes from routing any folder whose name starts with `_`**, so a path with
> `__builder` results in a 404. A folder without a leading underscore is used instead.

Bidirectional communication via `postMessage` with **shared types + Zod validation** on
both ends. Every message is validated; invalid ones are discarded and logged.

## 1. Security rules (mandatory)

- **Origin validation:** the host only accepts messages whose `event.origin === PREVIEW_ORIGIN`
  as configured; the guest only accepts messages from `ADMIN_ORIGIN`. Never `"*"` on receive.
- **Explicit `targetOrigin`** when sending (never `"*"`).
- **Nonce handshake:** the host generates a `channelId` (nanoid) and passes it to the iframe via
  querystring; both include `channelId` in every message. Non-matching ones are discarded.
- **Preview token:** the iframe loads with `?token=…` (short-lived, signed, with expiration) that
  authorizes viewing the draft. Without a valid token, Astro returns 401 (see [09/preview API]).
- **No `eval` or raw HTML** on the channel: only JSON payloads validated by Zod.

## 2. Common envelope

```ts
export const PROTOCOL_VERSION = 1 as const;

export interface Envelope<T extends BuilderMessage = BuilderMessage> {
  protocol: typeof PROTOCOL_VERSION;
  channelId: string;
  source: "host" | "guest";
  message: T;
}

// EnvelopeSchema = z.object({...}) validates protocol, channelId, source, and the discriminated union.
```

## 3. Host → guest messages (panel → preview)

```ts
export type HostMessage =
  | { type: "host/ready"; manifestVersion: number }
  | { type: "host/document-updated"; document: BuilderDocument }        // full replacement
  | { type: "host/node-props-updated"; nodeId: string; props: Record<string, unknown> } // patch
  | { type: "host/select-node"; nodeId: string | null }
  | { type: "host/hover-node"; nodeId: string | null }
  | { type: "host/request-scroll-to-node"; nodeId: string }
  | { type: "host/set-breakpoint"; breakpoint: string }
  | { type: "host/reload-preview" };
```

## 4. Guest → host messages (preview → panel)

```ts
export type GuestMessage =
  | { type: "guest/preview-ready"; documentId: string; renderedNodeIds: string[] }
  | { type: "guest/node-selected"; nodeId: string }                    // click on the canvas
  | { type: "guest/node-hovered"; nodeId: string | null }
  | { type: "guest/inline-edit"; nodeId: string; path: string; value: string } // inline edit
  | { type: "guest/request-insert-node"; parentId: string; index: number; blockType: string }
  | { type: "guest/preview-error"; nodeId?: string; message: string }
  | { type: "guest/schema-mismatch"; nodeId: string; blockType: string; expected: number; found: number };

export type BuilderMessage = HostMessage | GuestMessage;
```

Coverage of the required minimum events: builder ready (`host/ready`), preview ready
(`guest/preview-ready`), node selected (`guest/node-selected`), node hovered
(`guest/node-hovered`), document updated (`host/document-updated`), node props updated
(`host/node-props-updated`), request scroll (`host/request-scroll-to-node`), request insert
(`guest/request-insert-node`), preview error (`guest/preview-error`), schema mismatch
(`guest/schema-mismatch`), reload preview (`host/reload-preview`).

## 5. Lifecycle

```
host: creates iframe with ?channelId&token  ──►  guest loads Astro preview
guest: 'guest/preview-ready' (rendered nodes) ──►  host
host:  'host/ready' (manifest version)        ──►  guest
[editing]
  inspector changes a prop → host applies setProp command → 'host/node-props-updated' → guest re-renders that node
  click on canvas → 'guest/node-selected' → host selects in tree/inspector
  inline edit on canvas → 'guest/inline-edit' → host: dispatch setProp (source of truth = document)
  drag from block panel to canvas zone → 'guest/request-insert-node' → host: dispatch insertNode → 'host/document-updated'
[errors]
  unknown block/version → 'guest/schema-mismatch' → host marks node non-editable
  render failure → 'guest/preview-error' → host shows a banner, offers 'host/reload-preview'
```

## 6. Preview update strategy

- **Single-node prop change:** `host/node-props-updated` → the guest updates only that subtree
  (partial re-fetch or targeted hydration). Cheap and frequent.
- **Structural changes** (insert/move/delete): `host/document-updated` with the full tree;
  the guest asks the server for a document re-render (Astro SSR of the draft) or re-renders via
  the client runtime. In the MVP: **server-side re-render with debounce** (simple and faithful);
  optimizing to incremental patches is left for hardening.
- **Inline editing** never saves the `contenteditable` HTML: it emits `guest/inline-edit`
  `{ nodeId, path, value }` and the host converts it into `setProp`. The JSON document remains
  the source of truth.

## 7. Implementation (typed skeleton)

```ts
// host
function createHostChannel(iframe: HTMLIFrameElement, opts: { channelId: string; previewOrigin: string }) {
  function send(message: HostMessage) {
    const env: Envelope = { protocol: PROTOCOL_VERSION, channelId: opts.channelId, source: "host", message };
    iframe.contentWindow?.postMessage(env, opts.previewOrigin);   // explicit targetOrigin
  }
  window.addEventListener("message", (e) => {
    if (e.origin !== opts.previewOrigin) return;                  // validates origin
    const parsed = EnvelopeSchema.safeParse(e.data);
    if (!parsed.success || parsed.data.channelId !== opts.channelId || parsed.data.source !== "guest") return;
    handleGuest(parsed.data.message as GuestMessage);
  });
  return { send };
}
```

The guest (Astro, preview script) is symmetric: it validates `ADMIN_ORIGIN`, `channelId`, and
`source === "host"`. Both share `EnvelopeSchema`, `HostMessageSchema`, `GuestMessageSchema`
from `packages/contracts`.

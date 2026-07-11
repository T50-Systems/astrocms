# 05 — Protocolo de comunicación con el iframe (postMessage)

El canvas del builder es un `iframe` que carga el **proyecto Astro real** en modo preview:

```
/pages/:pageId/builder   (builder-react, "host")
        └── iframe ──►  /builder-preview/:documentId?channelId=…&token=…   (astro, "guest")
```

> **Nota de implementación:** la ruta de preview es `/builder-preview/:id`, **no** `/__builder/preview/`.
> Astro **excluye del enrutado cualquier carpeta cuyo nombre empiece por `_`**, así que un path con
> `__builder` da 404. Se usa una carpeta sin guion bajo inicial.

Comunicación bidireccional por `postMessage` con **tipos compartidos + validación Zod** en
ambos extremos. Todo mensaje se valida; los inválidos se descartan y se registran.

## 1. Reglas de seguridad (obligatorias)

- **Validación de origen:** el host sólo acepta mensajes cuyo `event.origin === PREVIEW_ORIGIN`
  configurado; el guest sólo acepta los de `ADMIN_ORIGIN`. Nunca `"*"` al recibir.
- **`targetOrigin` explícito** al enviar (nunca `"*"`).
- **Handshake con nonce:** el host genera un `channelId` (nanoid) y lo pasa al iframe por
  querystring; ambos incluyen `channelId` en cada mensaje. Se descartan los que no coincidan.
- **Token de preview:** el iframe carga con `?token=…` (corto, firmado, con expiración) que
  autoriza ver el draft. Sin token válido, Astro devuelve 401 (ver [09/API preview]).
- **Sin `eval` ni HTML crudo** en el canal: sólo payloads JSON validados por Zod.

## 2. Envelope común

```ts
export const PROTOCOL_VERSION = 1 as const;

export interface Envelope<T extends BuilderMessage = BuilderMessage> {
  protocol: typeof PROTOCOL_VERSION;
  channelId: string;
  source: "host" | "guest";
  message: T;
}

// EnvelopeSchema = z.object({...}) valida protocol, channelId, source y el discriminated union.
```

## 3. Mensajes host → guest (panel → preview)

```ts
export type HostMessage =
  | { type: "host/ready"; manifestVersion: number }
  | { type: "host/document-updated"; document: BuilderDocument }        // reemplazo completo
  | { type: "host/node-props-updated"; nodeId: string; props: Record<string, unknown> } // parche
  | { type: "host/select-node"; nodeId: string | null }
  | { type: "host/hover-node"; nodeId: string | null }
  | { type: "host/request-scroll-to-node"; nodeId: string }
  | { type: "host/set-breakpoint"; breakpoint: string }
  | { type: "host/reload-preview" };
```

## 4. Mensajes guest → host (preview → panel)

```ts
export type GuestMessage =
  | { type: "guest/preview-ready"; documentId: string; renderedNodeIds: string[] }
  | { type: "guest/node-selected"; nodeId: string }                    // click en el canvas
  | { type: "guest/node-hovered"; nodeId: string | null }
  | { type: "guest/inline-edit"; nodeId: string; path: string; value: string } // edición inline
  | { type: "guest/request-insert-node"; parentId: string; index: number; blockType: string }
  | { type: "guest/preview-error"; nodeId?: string; message: string }
  | { type: "guest/schema-mismatch"; nodeId: string; blockType: string; expected: number; found: number };

export type BuilderMessage = HostMessage | GuestMessage;
```

Cobertura de los eventos mínimos pedidos: builder ready (`host/ready`), preview ready
(`guest/preview-ready`), node selected (`guest/node-selected`), node hovered
(`guest/node-hovered`), document updated (`host/document-updated`), node props updated
(`host/node-props-updated`), request scroll (`host/request-scroll-to-node`), request insert
(`guest/request-insert-node`), preview error (`guest/preview-error`), schema mismatch
(`guest/schema-mismatch`), reload preview (`host/reload-preview`).

## 5. Ciclo de vida

```
host: crea iframe con ?channelId&token  ──►  guest carga Astro preview
guest: 'guest/preview-ready' (nodos renderizados) ──►  host
host:  'host/ready' (versión de manifiesto)        ──►  guest
[edición]
  inspector cambia prop → host aplica comando setProp → 'host/node-props-updated' → guest re-renderiza ese nodo
  click en canvas → 'guest/node-selected' → host selecciona en árbol/inspector
  edición inline en canvas → 'guest/inline-edit' → host: dispatch setProp (fuente de verdad = documento)
  drag desde panel de bloques a zona del canvas → 'guest/request-insert-node' → host: dispatch insertNode → 'host/document-updated'
[errores]
  bloque desconocido/versión → 'guest/schema-mismatch' → host marca nodo no editable
  fallo de render → 'guest/preview-error' → host muestra banner, ofrece 'host/reload-preview'
```

## 6. Estrategia de actualización del preview

- **Cambio de prop de un nodo:** `host/node-props-updated` → el guest actualiza sólo ese subárbol
  (re-fetch parcial o hidratación puntual). Barato y frecuente.
- **Cambios estructurales** (insertar/mover/borrar): `host/document-updated` con el árbol completo;
  el guest pide al servidor un re-render del documento (Astro SSR del draft) o re-renderiza vía
  runtime cliente. En el MVP: **re-render por servidor con debounce** (simple y fiel); optimización
  a parches incrementales queda para endurecimiento.
- **Edición inline** nunca guarda el HTML de `contenteditable`: emite `guest/inline-edit`
  `{ nodeId, path, value }` y el host lo convierte en `setProp`. El documento JSON sigue siendo la verdad.

## 7. Implementación (esqueleto tipado)

```ts
// host
function createHostChannel(iframe: HTMLIFrameElement, opts: { channelId: string; previewOrigin: string }) {
  function send(message: HostMessage) {
    const env: Envelope = { protocol: PROTOCOL_VERSION, channelId: opts.channelId, source: "host", message };
    iframe.contentWindow?.postMessage(env, opts.previewOrigin);   // targetOrigin explícito
  }
  window.addEventListener("message", (e) => {
    if (e.origin !== opts.previewOrigin) return;                  // valida origen
    const parsed = EnvelopeSchema.safeParse(e.data);
    if (!parsed.success || parsed.data.channelId !== opts.channelId || parsed.data.source !== "guest") return;
    handleGuest(parsed.data.message as GuestMessage);
  });
  return { send };
}
```

El guest (Astro, script del preview) es simétrico: valida `ADMIN_ORIGIN`, `channelId` y
`source === "host"`. Ambos comparten `EnvelopeSchema`, `HostMessageSchema`, `GuestMessageSchema`
desde `packages/contracts`.

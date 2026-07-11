# Incremento 5 (spec) — builder-react: UI visual del builder

Especificación para implementar el editor visual (producto 2, capa React) sobre `builder-core`.
Se ejecuta **después** del incremento de medios para evitar choques de `pnpm install`.

## Objetivo

`@astrocms/builder-react` + una ruta en `cms-admin` que monte el builder para una página con
`editorType: "builder"`. UI mínima pero funcional del Hito 5, sobre el engine ya existente.

## Alcance

1. **`packages/builder-react`** (nuevo, React 18):
   - `<BuilderProvider>` que crea/expone un `BuilderEngine` (de `@astrocms/builder-core`) vía context + un hook `useBuilder()` que se suscribe a `engine.subscribe` (con `useSyncExternalStore`).
   - **Panel de bloques**: lista los `manifest.blocks` por categoría; al hacer click/drag inserta un nodo (defaults del manifiesto) en el seleccionado o en la raíz.
   - **Árbol de nodos**: render recursivo del documento; click selecciona (`engine.select`); resalta el `selectedNodeId`; botones duplicar/ocultar/eliminar según `capabilities`.
   - **Inspector**: formulario generado desde `manifest.blocks[type].fields` (text/textarea/number/boolean/select/media) que hace `engine.dispatch({kind:'setProp', nodeId, path:'props.<key>', value})`. Media usa un picker que llama a `cms.media.list()` (del SDK, ya disponible tras el incremento de medios).
   - **Toolbar**: undo/redo (`engine.undo/redo`, deshabilitar con `canUndo/canRedo`), guardar (callback), publicar (callback), selector de breakpoint (`manifest.tokens.breakpoints`).
   - **Canvas con iframe**: carga `PREVIEW_ORIGIN` + ruta de preview del documento; implementa el **host** del protocolo `postMessage` de `@astrocms/contracts` (`envelopeSchema`, `hostMessageSchema`, `guestMessageSchema`): valida `origin` + `channelId`; envía `host/document-updated`/`host/select-node`; recibe `guest/node-selected`/`guest/inline-edit` (→ `setProp`)/`guest/preview-ready`. Usa `EnvelopeSchema` para validar.
   - dnd con **dnd-kit** para reordenar en el árbol (mínimo: reordenar hijos de un contenedor → `moveNode`, respetando `canInsert`).
   - Sin CSS libre; estilos propios del panel.
2. **`apps/astro-demo`**: ruta de **preview** `/__builder/preview/[id]` (SSR) que renderiza el documento (draft) con `BlockRenderer` en modo `preview` (inyecta `data-builder-*`) e incluye el script **guest** del protocolo (valida `ADMIN_ORIGIN` + `channelId`; emite `guest/preview-ready` y `guest/node-selected` en click sobre `[data-builder-node-id]`; aplica `host/*`). Autorizar con **token de preview** firmado (nuevo endpoint en cms-server: `POST /api/v1/preview/token` → token corto; el guest lo recibe por querystring y el CMS lo valida en un endpoint `GET /api/v1/preview/builder/documents/:id?token=`).
3. **`apps/cms-admin`**: ruta `/pages/$pageId/builder` que, si la página es `editorType:'builder'`, carga el documento (crea uno si falta), monta `builder-react` con `cmsBuilderAdapter`, y cablea guardar/publicar al CMS.
4. **Integración entry↔documento**: al cambiar una página a `editorType:'builder'`, `cms-core` crea un `builder_document` y guarda su id en `entry_versions.builderDocumentId`; el `entry` lo referencia. Endpoint/servicio para ello.

## Convenciones (idénticas al resto del repo)

- Ningún archivo > 500 LOC (trocear componentes). TS estricto, sin `any` injustificado.
- Paquete `@astrocms/builder-react`: `exports` → `./src/index.ts`; deps `@astrocms/builder-core`, `@astrocms/contracts`, `@astrocms/cms-sdk`, `@astrocms/builder-adapters`, `react`, `@dnd-kit/*`, `zod`.
- No commitear.

## Verificación

- `pnpm -r typecheck` en verde.
- `astro check` en `astro-demo` en verde.
- `vite build` de `cms-admin` en verde.
- Prueba en navegador (preview MCP): abrir la ruta del builder, insertar un Hero, editar el título en el inspector, ver el cambio en el iframe, guardar y publicar; comprobar `/b/:id` o `/__builder/preview/:id`.
- Idealmente, un test del protocolo `postMessage` (validación de origin/channelId con `envelopeSchema`).

## Notas

- El protocolo, los comandos y el manifiesto YA existen en `@astrocms/contracts` y `@astrocms/builder-core`; esta capa es **UI + wiring**, no lógica de dominio nueva.
- La edición inline y el re-render incremental del preview pueden empezar por la vía simple: en cambios estructurales, `host/document-updated` → el guest re-fetch/re-render del draft.

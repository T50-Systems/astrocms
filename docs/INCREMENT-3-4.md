# Incrementos 3 y 4 — Builder conectado al CMS y renderizado por Astro

Conectan producto 1 (CMS) y producto 2 (builder), y hacen que **Astro renderice documentos del
builder**. Verificado con integración (Postgres real) y SSR (curl).

## Incremento 3 — Persistencia del builder en el CMS

| Capa | Contenido |
|------|-----------|
| `cms-database` | Tablas `builder_documents` + `builder_document_versions` (migración `0001`) |
| `cms-core` | `builder-service`: create, get, saveDraft (nueva versión), publish, revisions, restore, getPublished |
| `cms-server` | `/api/v1/builder/documents` (POST/GET/PUT/publish/revisions/restore) con Zod + RBAC (`pages.*`) |
| `cms-sdk` | `cms.builder.*` (create/get/save/publish/revisions/restore) |
| `builder-adapters` | `cmsBuilderAdapter(cms)` — `BuilderStorageAdapter` sobre el SDK |

**Test de integración end-to-end** (contra Postgres): `engine → cmsBuilderAdapter → cms-sdk →
API → cms-core → DB`. Crea un documento, lo edita con el **engine** de `builder-core`, guarda draft
(nueva versión), publica y restaura la v1. Prueba que el builder opera el CMS **sólo por contratos
públicos**, nunca tocando sus tablas.

## Incremento 4 — Renderer de bloques en Astro

| Capa | Contenido |
|------|-----------|
| `astro-demo` | `BlockRenderer.astro` (recursivo), registro `registry.ts` (type→componente), bloques `Page/Hero/Heading/Paragraph/Section/Button` |
| `cms-server` | `GET /api/v1/public/builder/documents/:id` (sólo publicado) |
| `cms-sdk` | `cms.public.getBuilderDocument(id)` |
| Ruta | `/b/:id` — SSR que renderiza el árbol publicado |

**Verificación SSR:** creado un documento `core/page → [hero, paragraph]`, publicado y servido en
`/b/:id`; Astro renderiza el `<h1>Hola Builder</h1>` + descripción + párrafo desde el JSON. Cadena
completa **documento JSON → publicado → API pública → renderer recursivo → HTML**. En modo preview
el renderer inyecta `data-builder-node-id/type` (base del protocolo iframe).

## Estado global

- **35 tests verdes** (contracts 4, cms-auth 2, cms-core 4, cms-sdk 3, schemas 3, builder-core 8,
  builder-adapters 3, cms-server 8) + typecheck estricto en 11 proyectos + verificación en navegador (panel) y SSR (Astro).
- Ambos productos existen y están **conectados por contratos/SDK/adaptadores**, como exige el diseño.

## Pendiente para el criterio de éxito completo

`builder-react` (canvas + iframe + árbol + inspector + dnd + edición inline + undo/redo UI),
ruta de preview con **token** + wiring `postMessage`, integración del builder como editor de una
página (entry `editorType:'builder'` ↔ documento), media library (Sharp), menús/SEO/ajustes en el
panel, webhooks, endpoint de manifiesto, CLI/MCP (AI-native), y el **e2e Playwright** de los 18 pasos.

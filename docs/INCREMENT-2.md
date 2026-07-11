# Incremento vertical 2 — Base del builder (producto 2)

Fundamento del builder visual, **TS puro y framework-agnóstico**, verificado con tests unitarios
(sin infra ni navegador). Cubre el Hito 4 del [roadmap](08-roadmap.md).

## Qué incluye

| Paquete | Contenido | Tests |
|---------|-----------|-------|
| `@astrocms/contracts` (+builder) | `BuilderDocument`/`BuilderNode`, `BlockManifest`, `BuilderCommand`, `ValidationResult`, y **protocolo iframe** (`Envelope` + Host/Guest messages) — todo con Zod | — |
| `@astrocms/schemas` | Sistema de campos (text, textarea, richText, number, boolean, select, url, slug, media) → cada uno genera Zod + default + serialize; `defineBlock`, `serializeBlock`, `buildManifest`, `DEFAULT_TOKENS` | 3 |
| `@astrocms/builder-core` | `createEngine`: dispatch de comandos reversibles, **undo/redo determinista** (snapshots), selección, `clone` (ids nuevos en profundidad), `validateDocument` (tipos/constraints/campos requeridos), `migrateDocument` (por versión de bloque), utilidades de árbol inmutables | 8 |
| `@astrocms/builder-adapters` | `BuilderStorageAdapter` + `inMemory` (tests) y `jsonFile` (dev): load/saveDraft/publish/revisiones/restore — **intercambiables** | 3 |

## Garantías verificadas

- **El manifiesto NO contiene `component`** (el código Astro nunca viaja al panel) — test explícito.
- **Undo→Redo round-trip exacto** (comparación de snapshot JSON).
- **Clone/duplicate regeneran ids** en profundidad (sin colisiones con el original).
- **Nodo `locked` no se borra/mueve**; bloqueo estructural respetado.
- **Validación** detecta bloque desconocido, campo requerido vacío, hijos no permitidos, min/max, padre inválido.
- **Migración** aplica cadenas `from→to` por versión; sin ruta → nodo intacto (el preview emitirá `schema-mismatch`).
- **Adaptadores intercambiables**: misma interfaz, inMemory y jsonFile pasan el mismo round-trip.

## Diseño (Architecture Advisor)

- **Comportamiento del documento:** árbol JSON + comandos reversibles; historial por snapshots
  (simple y determinista; suficiente para mono-editor, sin CRDT/OT prematuro).
- **El modelo de comandos es también el API seguro para IA** (ADR-0009): toda mutación —humana o IA—
  pasa por `BuilderCommand` validado; no hay HTML/CSS/JS libre.
- **Desacoplo:** `builder-core` no depende de React ni del CMS; sólo de `contracts`. Los adaptadores
  aíslan el backend (portabilidad, ADR-0008). Las migraciones se inyectan por registro (no acopla a `schemas`).

## Pendiente del builder (siguientes incrementos)

Persistencia de documentos en el CMS (tablas `builder_documents(_versions)` + API + `cms-sdk.builder`),
`builder-react` (canvas/iframe/inspector/árbol/dnd), `builder-astro` (renderer + `defineBuilderConfig` +
`data-builder-*`), ruta de preview con token, `builder-default-blocks` (10 bloques), y el e2e del
criterio de éxito.

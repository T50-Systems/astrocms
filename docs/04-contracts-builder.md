# 04 — Contratos TypeScript del builder

Viven en `packages/contracts` (documento + manifiesto + adaptador) y `packages/builder-core`
(comandos/estado, sin dependencia del CMS). El builder es agnóstico de backend: sólo conoce el
`BuilderStorageAdapter` y el `BlockManifest`.

## 1. Documento como árbol JSON

```ts
export interface BuilderDocument {
  id: ID;
  schemaVersion: number;             // versión del formato de documento (no de bloques)
  root: BuilderNode;                 // siempre type 'core/page'
  meta?: DocumentMeta;
}

export interface BuilderNode {
  id: string;                        // único dentro del documento (nanoid)
  type: string;                      // 'core/page' | 'site/hero' | ...
  version: number;                   // versión del ESQUEMA DEL BLOQUE (para migraciones)
  props: Record<string, unknown>;    // validado contra el schema del bloque en el manifiesto
  children: BuilderNode[];
  hidden?: boolean;                  // ocultar sin eliminar
  locked?: boolean;                  // bloqueo estructural: no se mueve/borra
}

export interface DocumentMeta {
  createdAt?: ISODateTime;
  updatedAt?: ISODateTime;
  title?: string;
}

// Referencias tipadas dentro de props (nunca URLs/HTML crudos):
export interface MediaRef { kind: "media"; assetId: ID; }
export interface EntityRef { kind: "entity"; contentTypeKey: string; entryId: ID; }
```

Requisitos cubiertos: nodos, props, hijos, versiones, metadata, bloqueos estructurales
(`locked`), refs a medios (`MediaRef`) y a entidades del CMS (`EntityRef`), validación,
migraciones (`version` por nodo), clonado, undo/redo, comparación de revisiones.

## 2. Manifiesto de bloques (lo único que ve el panel)

El código Astro **no** viaja; el panel sólo recibe esquema + metadatos.

```ts
export interface BlockManifest {
  schemaVersion: number;
  blocks: BlockDefinitionSerialized[];
  tokens: ThemeTokens;               // spacing/widths/columns/colors del tema
}

export interface BlockDefinitionSerialized {
  type: string;                      // 'site/hero'
  label: string;
  category: string;                  // 'Marketing' | 'Layout' | 'Contenido' | ...
  icon?: string;                     // nombre de icono (no SVG arbitrario)
  version: number;
  fields: SerializedField[];         // derivado del schema de campos → formularios del inspector
  defaults: Record<string, unknown>;
  constraints: BlockConstraints;
  capabilities: BlockCapabilities;
  hasPreviewComponent: boolean;
  // NOTA: sin 'component' — la ruta al .astro se queda en el proyecto Astro.
}

export interface BlockConstraints {
  allowedParents?: string[];         // tipos permitidos como padre
  allowedChildren?: string[];        // tipos permitidos como hijo (o '*')
  minChildren?: number;
  maxChildren?: number;
}

export interface BlockCapabilities {
  acceptsChildren: boolean;
  duplicable: boolean;
  removable: boolean;
  hideable: boolean;
  permission?: PermissionKey;        // permiso opcional para usar el bloque
}

export interface SerializedField {
  key: string;
  type: FieldType;
  label: string;
  required: boolean;
  config: Record<string, unknown>;   // opciones ya serializadas (options, min/max, etc.)
}

export interface ThemeTokens {
  spacing: string[];                 // ['none','xs','sm','md','lg','xl']
  widths: string[];                  // ['content','wide','full']
  columns: number[];                 // [1,2,3,4]
  colors: string[];                  // tokens semánticos, no hex libres
  breakpoints: string[];             // ['mobile','tablet','desktop'] (del tema)
}
```

## 3. Definición de bloque (lado Astro, `defineBlock`)

Vive en el proyecto Astro / `builder-default-blocks`. `builder-astro` la serializa a
`BlockDefinitionSerialized` para el manifiesto y conserva `component` sólo del lado servidor.

```ts
export interface BlockDefinition<TProps = Record<string, unknown>> {
  type: string;
  label: string;
  category: string;
  icon?: string;
  version: number;
  component: string;                 // ruta .astro — NUNCA se serializa al panel
  previewComponent?: string;         // opcional
  fields: FieldMap;                  // del sistema de campos (packages/schemas)
  defaults?: Partial<TProps>;
  constraints?: BlockConstraints;
  capabilities?: Partial<BlockCapabilities>;
  migrations?: BlockMigration[];
}

export interface BlockMigration {
  from: number;                      // version origen
  to: number;                        // version destino
  migrate(props: Record<string, unknown>): Record<string, unknown>;
}
```

## 4. Estado y comandos (`builder-core`, framework-agnóstico)

El core mantiene el documento + selección + historial. Toda mutación pasa por un **comando**
reversible (patrón command → undo/redo determinista).

```ts
export interface BuilderState {
  document: BuilderDocument;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  breakpoint: string;                // token de breakpoint activo en el canvas
}

export type BuilderCommand =
  | { kind: "insertNode"; parentId: string; index: number; node: BuilderNode }
  | { kind: "removeNode"; nodeId: string }
  | { kind: "moveNode"; nodeId: string; toParentId: string; toIndex: number }
  | { kind: "duplicateNode"; nodeId: string }
  | { kind: "setProp"; nodeId: string; path: string; value: unknown }
  | { kind: "setHidden"; nodeId: string; hidden: boolean }
  | { kind: "setLocked"; nodeId: string; locked: boolean }
  | { kind: "pasteNode"; parentId: string; index: number; node: BuilderNode };

export interface BuilderEngine {
  getState(): BuilderState;
  dispatch(cmd: BuilderCommand): void;      // aplica + apila en historial
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  select(nodeId: string | null): void;
  clone(nodeId: string): BuilderNode;       // ids regenerados
  validate(): ValidationResult;             // contra manifiesto (constraints + campos Zod)
  subscribe(listener: (s: BuilderState) => void): () => void;
}
```

`setProp` con `path` (p.ej. `"props.title"`, `"props.columns.desktop"`) es la unidad de cambio
que también usan la edición inline y el inspector — un único camino de mutación.

## 5. Migraciones de bloques

Al cargar un documento, para cada nodo cuyo `version < manifest.block.version` se aplican en
orden las `migrations` (`from → to`) hasta alcanzar la versión actual; se registra el resultado.

```ts
export function migrateDocument(
  doc: BuilderDocument,
  manifest: BlockManifest,
  registry: Map<string, BlockMigration[]>,
): { document: BuilderDocument; applied: Array<{ nodeId: string; from: number; to: number }> };
```

Si falta un tipo de bloque o no hay ruta de migración → evento `schema-mismatch` al panel
(ver [05-iframe-protocol](05-iframe-protocol.md)) y el nodo se marca como no editable, sin romper el resto.

## 6. Adaptador de almacenamiento (portabilidad del builder)

Única interfaz entre el builder y cualquier backend. `cmsBuilderAdapter` la implementa sobre `cms-sdk`.

```ts
export interface BuilderStorageAdapter {
  loadDocument(id: ID): Promise<BuilderDocument>;
  saveDraft(document: BuilderDocument): Promise<void>;
  publish(documentId: ID): Promise<void>;
  getRevisionHistory(documentId: ID): Promise<BuilderRevision[]>;
  restoreRevision(documentId: ID, revisionId: string): Promise<BuilderDocument>;
  listMedia(query?: MediaQuery): Promise<MediaAsset[]>;
  uploadMedia(file: File): Promise<MediaAsset>;
  getManifest(): Promise<BlockManifest>;
}

export interface BuilderRevision {
  id: string;                        // versionNo o id
  createdAt: ISODateTime;
  createdBy: ID;
  note?: string;
  isPublished: boolean;
}

// Fábrica del cliente del builder (consume un adaptador):
export function createBuilderClient(opts: { adapter: BuilderStorageAdapter }): {
  load(documentId: ID): Promise<{ engine: BuilderEngine; manifest: BlockManifest }>;
  save(): Promise<void>;
  publish(): Promise<void>;
};
```

Adaptadores del MVP: `cmsBuilderAdapter(cms)` (producción), `inMemoryAdapter()` (tests),
`jsonFileAdapter(path)` (desarrollo local sin CMS). El builder **no** implementa usuarios,
login, roles, DB, media propia ni publicación: todo llega por el adaptador.

## 7. Ejemplo de uso extremo a extremo

```ts
const cms = createCmsClient({ baseUrl: "/api/v1", credentials: "include" });
const page = await cms.pages.get(pageId);

const builder = createBuilderClient({ adapter: cmsBuilderAdapter(cms) });
const { engine, manifest } = await builder.load(page.builderDocumentId!);

engine.dispatch({
  kind: "insertNode",
  parentId: "root",
  index: 0,
  node: { id: nano(), type: "site/hero", version: 1, props: { title: "Bienvenido" }, children: [] },
});
await builder.save();      // saveDraft vía adaptador → PUT /builder/documents/:id
```

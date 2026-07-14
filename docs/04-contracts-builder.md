# 04 — Builder TypeScript contracts

They live in `packages/contracts` (document + manifest + adapter) and `packages/builder-core`
(commands/state, with no dependency on the CMS). The builder is backend-agnostic: it only knows
the `BuilderStorageAdapter` and the `BlockManifest`.

## 1. Document as a JSON tree

```ts
export interface BuilderDocument {
  id: ID;
  schemaVersion: number;             // document format version (not the block version)
  root: BuilderNode;                 // always type 'core/page'
  meta?: DocumentMeta;
}

export interface BuilderNode {
  id: string;                        // unique within the document (nanoid)
  type: string;                      // 'core/page' | 'site/hero' | ...
  version: number;                   // BLOCK SCHEMA version (for migrations)
  props: Record<string, unknown>;    // validated against the block schema in the manifest
  children: BuilderNode[];
  hidden?: boolean;                  // hide without deleting
  locked?: boolean;                  // structural lock: cannot be moved/deleted
}

export interface DocumentMeta {
  createdAt?: ISODateTime;
  updatedAt?: ISODateTime;
  title?: string;
}

// Typed references inside props (never raw URLs/HTML):
export interface MediaRef { kind: "media"; assetId: ID; }
export interface EntityRef { kind: "entity"; contentTypeKey: string; entryId: ID; }
```

Requirements covered: nodes, props, children, versions, metadata, structural locks
(`locked`), refs to media (`MediaRef`) and to CMS entities (`EntityRef`), validation,
migrations (`version` per node), cloning, undo/redo, revision comparison.

## 2. Block manifest (the only thing the panel sees)

The Astro code **does not** travel; the panel only receives schema + metadata.

```ts
export interface BlockManifest {
  schemaVersion: number;
  blocks: BlockDefinitionSerialized[];
  tokens: ThemeTokens;               // theme spacing/widths/columns/colors
}

export interface BlockDefinitionSerialized {
  type: string;                      // 'site/hero'
  label: string;
  category: string;                  // 'Marketing' | 'Layout' | 'Content' | ...
  icon?: string;                     // icon name (not arbitrary SVG)
  version: number;
  fields: SerializedField[];         // derived from the field schema → inspector forms
  defaults: Record<string, unknown>;
  constraints: BlockConstraints;
  capabilities: BlockCapabilities;
  hasPreviewComponent: boolean;
  // NOTE: no 'component' — the path to the .astro file stays in the Astro project.
}

export interface BlockConstraints {
  allowedParents?: string[];         // allowed types as parent
  allowedChildren?: string[];        // allowed types as child (or '*')
  minChildren?: number;
  maxChildren?: number;
}

export interface BlockCapabilities {
  acceptsChildren: boolean;
  duplicable: boolean;
  removable: boolean;
  hideable: boolean;
  permission?: PermissionKey;        // optional permission to use the block
}

export interface SerializedField {
  key: string;
  type: FieldType;
  label: string;
  required: boolean;
  config: Record<string, unknown>;   // already-serialized options (options, min/max, etc.)
}

export interface ThemeTokens {
  spacing: string[];                 // ['none','xs','sm','md','lg','xl']
  widths: string[];                  // ['content','wide','full']
  columns: number[];                 // [1,2,3,4]
  colors: string[];                  // semantic tokens, not free hex
  breakpoints: string[];             // ['mobile','tablet','desktop'] (from the theme)
}
```

## 3. Block definition (Astro side, `defineBlock`)

Lives in the Astro project / `builder-default-blocks`. `builder-astro` serializes it to
`BlockDefinitionSerialized` for the manifest and keeps `component` only on the server side.

```ts
export interface BlockDefinition<TProps = Record<string, unknown>> {
  type: string;
  label: string;
  category: string;
  icon?: string;
  version: number;
  component: string;                 // .astro path — NEVER serialized to the panel
  previewComponent?: string;         // optional
  fields: FieldMap;                  // from the field system (packages/schemas)
  defaults?: Partial<TProps>;
  constraints?: BlockConstraints;
  capabilities?: Partial<BlockCapabilities>;
  migrations?: BlockMigration[];
}

export interface BlockMigration {
  from: number;                      // source version
  to: number;                        // target version
  migrate(props: Record<string, unknown>): Record<string, unknown>;
}
```

## 4. State and commands (`builder-core`, framework-agnostic)

The core holds the document + selection + history. Every mutation goes through a reversible
**command** (command pattern → deterministic undo/redo).

```ts
export interface BuilderState {
  document: BuilderDocument;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  breakpoint: string;                // active breakpoint token in the canvas
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
  dispatch(cmd: BuilderCommand): void;      // applies + pushes onto history
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  select(nodeId: string | null): void;
  clone(nodeId: string): BuilderNode;       // ids regenerated
  validate(): ValidationResult;             // against the manifest (constraints + Zod fields)
  subscribe(listener: (s: BuilderState) => void): () => void;
}
```

`setProp` with a `path` (e.g. `"props.title"`, `"props.columns.desktop"`) is the unit of change
also used by inline editing and the inspector — a single mutation path.

## 5. Block migrations

When loading a document, for every node whose `version < manifest.block.version` the
`migrations` (`from → to`) are applied in order until the current version is reached; the
result is recorded.

```ts
export function migrateDocument(
  doc: BuilderDocument,
  manifest: BlockManifest,
  registry: Map<string, BlockMigration[]>,
): { document: BuilderDocument; applied: Array<{ nodeId: string; from: number; to: number }> };
```

If a block type is missing or there is no migration path → a `schema-mismatch` event is sent to
the panel (see [05-iframe-protocol](05-iframe-protocol.md)) and the node is marked non-editable,
without breaking the rest.

## 6. Storage adapter (builder portability)

The only interface between the builder and any backend. `cmsBuilderAdapter` implements it on top of `cms-sdk`.

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
  id: string;                        // versionNo or id
  createdAt: ISODateTime;
  createdBy: ID;
  note?: string;
  isPublished: boolean;
}

// Builder client factory (consumes an adapter):
export function createBuilderClient(opts: { adapter: BuilderStorageAdapter }): {
  load(documentId: ID): Promise<{ engine: BuilderEngine; manifest: BlockManifest }>;
  save(): Promise<void>;
  publish(): Promise<void>;
};
```

MVP adapters: `cmsBuilderAdapter(cms)` (production), `inMemoryAdapter()` (tests),
`jsonFileAdapter(path)` (local development without a CMS). The builder does **not** implement
users, login, roles, DB, its own media, or publishing: everything arrives through the adapter.

## 7. End-to-end usage example

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
await builder.save();      // saveDraft via adapter → PUT /builder/documents/:id
```

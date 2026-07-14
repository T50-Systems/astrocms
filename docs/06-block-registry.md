# 06 — Astro block registry and field system

## 1. Goal

The Astro project registers its blocks with **declarative schemas**. From these a
**serializable manifest** (schema + metadata) is generated, which the builder consumes. The
**`.astro` component code is never sent to the panel** — Astro keeps the rendering.

From each block definition the following are derived automatically: TS prop types, validation
Zod schema, inspector form, API validation, defaults, and documentation.

## 2. `defineBlock` and `defineBuilderConfig`

```ts
// astro-demo/src/builder/blocks/hero.ts
import { defineBlock, text, richText, media, select } from "@astrocms/schemas";

export const hero = defineBlock({
  type: "site/hero",
  label: "Hero",
  category: "Marketing",
  version: 1,
  component: "./src/components/builder/Hero.astro",   // stays in Astro
  fields: {
    title: text({ label: "Título", required: true }),
    description: richText({ label: "Descripción" }),
    image: media({ label: "Imagen" }),
    alignment: select({ label: "Alineación", options: ["left", "center", "right"], default: "center" }),
  },
  capabilities: { acceptsChildren: false, duplicable: true, removable: true, hideable: true },
  // constraints, defaults, and migrations are optional
});
```

```ts
// astro-demo/src/builder/config.ts
import { defineBuilderConfig } from "@astrocms/builder-astro";
import { defaultBlocks } from "@astrocms/builder-default-blocks";
import { hero } from "./blocks/hero";

export default defineBuilderConfig({
  blocks: [...defaultBlocks, hero],
});
```

## 3. Field system (`packages/schemas`)

Each field type is a **descriptor** that produces four artifacts from a single definition:

```ts
export interface FieldDescriptor<TConfig, TValue> {
  type: FieldType;
  /** Zod to validate the VALUE (API + builder). */
  toZod(config: TConfig): z.ZodType<TValue>;
  /** Default value. */
  defaultValue(config: TConfig): TValue;
  /** Serializable metadata for the inspector form (no logic). */
  serialize(config: TConfig): SerializedField;
  /** (dev) documentation snippet. */
  describe(config: TConfig): string;
}

// Helper used to declare fields in defineBlock:
export function text(config?: TextConfig): FieldSpec<string> { /* ... */ }
export function media(config?: MediaConfig): FieldSpec<MediaRef> { /* ... */ }
export function repeater<T>(config: RepeaterConfig<T>): FieldSpec<T[]> { /* ... */ }
// ... etc
```

MVP field catalog (all with Zod + TS + form + defaults):

`text`, `textarea`, `richText`, `number`, `boolean`, `select`, `multiSelect`, `date`,
`dateTime`, `colorToken`, `spacingToken`, `url`, `slug`, `media`, `gallery`, `relation`,
`taxonomy`, `object`, `repeater`, `blocks`, `json`, and `plugin:<name>` (plugin field).

Rules:
- **`colorToken` / `spacingToken`** only accept values from `ThemeTokens` (no free hex/px) →
  satisfies "no arbitrary CSS".
- **`media` / `gallery`** store `MediaRef { assetId }`, not URLs.
- **`relation` / `taxonomy`** store `EntityRef` / term ids.
- **`richText`** stores Tiptap JSON (not raw HTML); it is sanitized when rendered.
- Responsive fields: any "tokenized" field can be wrapped in `Responsive<T>`:

```ts
export type Responsive<T> = { [breakpoint: string]: T };   // { mobile:1, tablet:2, desktop:4 }
```

## 4. Manifest generation

`builder-astro` walks the config, and for each block emits a `BlockDefinitionSerialized`
(see [04-contracts-builder](04-contracts-builder.md) §2):

```ts
export function buildManifest(config: BuilderConfig, tokens: ThemeTokens): BlockManifest {
  return {
    schemaVersion: 1,
    tokens,
    blocks: config.blocks.map((b) => ({
      type: b.type, label: b.label, category: b.category, icon: b.icon, version: b.version,
      fields: Object.entries(b.fields).map(([key, spec]) => spec.serialize(key)),
      defaults: computeDefaults(b.fields, b.defaults),
      constraints: b.constraints ?? {},
      capabilities: withCapabilityDefaults(b.capabilities),
      hasPreviewComponent: Boolean(b.previewComponent),
      // 'component' is deliberately OMITTED
    })),
  };
}
```

The manifest is exposed at `GET /api/v1/builder/manifest`. It is cached by `schemaVersion` +
config hash. The Astro server keeps a private `type → component` map for rendering.

## 5. Recursive renderer in Astro (`builder-astro`)

```astro
---
// BlockRenderer.astro
import { blockComponents } from "../builder/registry.generated";  // type → .astro component
const { node } = Astro.props as { node: BuilderNode };
if (node.hidden) return null;
const Component = blockComponents[node.type];
---
{Component ? (
  <Component
    {...node.props}
    data-builder-node-id={node.id}
    data-builder-type={node.type}
  >
    {node.children.map((child) => <BlockRenderer node={child} />)}
  </Component>
) : (
  <div data-builder-node-id={node.id} data-builder-unknown={node.type}>
    <!-- unknown block → emits schema-mismatch to the host -->
  </div>
)}
```

Each rendered block includes `data-builder-node-id` and `data-builder-type` so the canvas can
map clicks/hover to nodes (iframe protocol). In public production, these attributes are
omitted (only injected on the preview route).

## 6. MVP block catalog (≥10)

**Content:** Heading, Paragraph, RichText, Image, Button, Quote, List, Divider.
**Layout:** Section, Container, Stack, Grid, Columns, Column.
**Site:** Hero, ServiceGrid, Testimonials, CTA (+ more per project).

The 10 MVP base blocks are served from `builder-default-blocks`; site-specific ones are
registered by each Astro project. Each block declares: type, name, category, icon, version,
props, defaults, allowed parents/children, min/max children, duplicable, removable, hideable,
migrations, Astro component, optional preview, and optional permissions
(see `BlockDefinition` in [04-contracts-builder](04-contracts-builder.md)).

## 7. Why the code doesn't travel to the panel

- **Security:** the panel never executes project code; this removes an XSS/RCE surface.
- **Decoupling:** the builder works with any backend/theme as long as a manifest exists.
- **Updates:** changing a block's rendering (same schema/version) doesn't require touching
  documents or the panel.

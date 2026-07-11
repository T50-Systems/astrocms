# 06 — Registro de bloques Astro y sistema de campos

## 1. Objetivo

El proyecto Astro registra sus bloques con **esquemas declarativos**. De ahí se genera un
**manifiesto serializable** (esquema + metadatos) que consume el builder. El **código del
componente `.astro` nunca se envía al panel** — Astro conserva el render.

De cada definición de bloque se derivan automáticamente: tipos TS de props, esquema Zod de
validación, formulario del inspector, validación de API, defaults y documentación.

## 2. `defineBlock` y `defineBuilderConfig`

```ts
// astro-demo/src/builder/blocks/hero.ts
import { defineBlock, text, richText, media, select } from "@astrocms/schemas";

export const hero = defineBlock({
  type: "site/hero",
  label: "Hero",
  category: "Marketing",
  version: 1,
  component: "./src/components/builder/Hero.astro",   // se queda en Astro
  fields: {
    title: text({ label: "Título", required: true }),
    description: richText({ label: "Descripción" }),
    image: media({ label: "Imagen" }),
    alignment: select({ label: "Alineación", options: ["left", "center", "right"], default: "center" }),
  },
  capabilities: { acceptsChildren: false, duplicable: true, removable: true, hideable: true },
  // constraints, defaults y migrations son opcionales
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

## 3. Sistema de campos (`packages/schemas`)

Cada tipo de campo es un **descriptor** que produce cuatro artefactos desde una sola definición:

```ts
export interface FieldDescriptor<TConfig, TValue> {
  type: FieldType;
  /** Zod para validar el VALOR (API + builder). */
  toZod(config: TConfig): z.ZodType<TValue>;
  /** Valor por defecto. */
  defaultValue(config: TConfig): TValue;
  /** Metadatos serializables para el formulario del inspector (sin lógica). */
  serialize(config: TConfig): SerializedField;
  /** (dev) fragmento de documentación. */
  describe(config: TConfig): string;
}

// Helper con el que se declaran los campos en defineBlock:
export function text(config?: TextConfig): FieldSpec<string> { /* ... */ }
export function media(config?: MediaConfig): FieldSpec<MediaRef> { /* ... */ }
export function repeater<T>(config: RepeaterConfig<T>): FieldSpec<T[]> { /* ... */ }
// ... etc
```

Catálogo de campos del MVP (todos con Zod + TS + form + defaults):

`text`, `textarea`, `richText`, `number`, `boolean`, `select`, `multiSelect`, `date`,
`dateTime`, `colorToken`, `spacingToken`, `url`, `slug`, `media`, `gallery`, `relation`,
`taxonomy`, `object`, `repeater`, `blocks`, `json`, y `plugin:<name>` (campo de plugin).

Reglas:
- **`colorToken` / `spacingToken`** sólo aceptan valores del `ThemeTokens` (no hex/px libres) →
  cumple "sin CSS arbitrario".
- **`media` / `gallery`** almacenan `MediaRef { assetId }`, no URLs.
- **`relation` / `taxonomy`** almacenan `EntityRef` / term ids.
- **`richText`** guarda JSON de Tiptap (no HTML crudo); se sanea al renderizar.
- Campos responsive: cualquier campo "tokenizado" puede envolverse en `Responsive<T>`:

```ts
export type Responsive<T> = { [breakpoint: string]: T };   // { mobile:1, tablet:2, desktop:4 }
```

## 4. Generación del manifiesto

`builder-astro` recorre la config, y por cada bloque emite `BlockDefinitionSerialized`
(ver [04-contracts-builder](04-contracts-builder.md) §2):

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
      // 'component' se OMITE deliberadamente
    })),
  };
}
```

El manifiesto se expone en `GET /api/v1/builder/manifest`. Se cachea por `schemaVersion` +
hash de config. El servidor de Astro guarda un mapa `type → component` privado para renderizar.

## 5. Renderer recursivo en Astro (`builder-astro`)

```astro
---
// BlockRenderer.astro
import { blockComponents } from "../builder/registry.generated";  // type → componente .astro
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
    <!-- bloque desconocido → emite schema-mismatch al host -->
  </div>
)}
```

Cada bloque renderizado incluye `data-builder-node-id` y `data-builder-type` para que el canvas
mapee clicks/hover a nodos (protocolo del iframe). En producción pública, estos atributos se
omiten (sólo se inyectan en la ruta de preview).

## 6. Catálogo de bloques del MVP (≥10)

**Contenido:** Heading, Paragraph, RichText, Image, Button, Quote, List, Divider.
**Layout:** Section, Container, Stack, Grid, Columns, Column.
**Sitio:** Hero, ServiceGrid, Testimonials, CTA (+ más por proyecto).

Los 10 base del MVP se sirven desde `builder-default-blocks`; los específicos del sitio los
registra cada proyecto Astro. Cada bloque declara: tipo, nombre, categoría, icono, versión,
props, defaults, padres/hijos permitidos, min/max hijos, duplicable, removable, hideable,
migraciones, componente Astro, preview opcional y permisos opcionales
(ver `BlockDefinition` en [04-contracts-builder](04-contracts-builder.md)).

## 7. Por qué el código no viaja al panel

- **Seguridad:** el panel nunca ejecuta código del proyecto; elimina una superficie de XSS/RCE.
- **Desacoplo:** el builder funciona con cualquier backend/tema mientras exista un manifiesto.
- **Actualización:** cambiar el render de un bloque (mismo esquema/version) no requiere tocar
  documentos ni el panel.

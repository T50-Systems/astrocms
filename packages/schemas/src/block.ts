import { z } from "zod";
import type {
  BlockCapabilities,
  BlockConstraints,
  BlockDefinitionSerialized,
  BlockManifest,
  ThemeTokens,
} from "@astrocms/contracts";
import type { FieldMap } from "./fields.js";

export interface BlockMigration {
  from: number;
  to: number;
  migrate(props: Record<string, unknown>): Record<string, unknown>;
}

export interface BlockDefinition {
  type: string;
  label: string;
  category: string;
  version: number;
  /** Ruta al .astro — NUNCA se serializa al panel. */
  component: string;
  previewComponent?: string;
  icon?: string;
  fields: FieldMap;
  defaults?: Record<string, unknown>;
  constraints?: BlockConstraints;
  capabilities?: Partial<BlockCapabilities>;
  migrations?: BlockMigration[];
}

export function defineBlock(def: BlockDefinition): BlockDefinition {
  return def;
}

const DEFAULT_CAPS: BlockCapabilities = {
  acceptsChildren: false,
  duplicable: true,
  removable: true,
  hideable: true,
};

/** Zod de las props del bloque (para validación en builder-core). */
export function blockZod(def: BlockDefinition): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const [key, spec] of Object.entries(def.fields)) shape[key] = spec.toZod();
  return z.object(shape);
}

export function blockDefaults(def: BlockDefinition): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(def.fields)) {
    const v = spec.defaultValue();
    if (v !== undefined) out[key] = v;
  }
  return { ...out, ...(def.defaults ?? {}) };
}

/** Serializa un bloque para el manifiesto, OMITIENDO `component`/`previewComponent`. */
export function serializeBlock(def: BlockDefinition): BlockDefinitionSerialized {
  return {
    type: def.type,
    label: def.label,
    category: def.category,
    ...(def.icon ? { icon: def.icon } : {}),
    version: def.version,
    fields: Object.entries(def.fields).map(([key, spec]) => spec.serialize(key)),
    defaults: blockDefaults(def),
    constraints: def.constraints ?? {},
    capabilities: { ...DEFAULT_CAPS, ...(def.capabilities ?? {}) },
    hasPreviewComponent: Boolean(def.previewComponent),
  };
}

export function buildManifest(blocks: BlockDefinition[], tokens: ThemeTokens): BlockManifest {
  return { schemaVersion: 1, blocks: blocks.map(serializeBlock), tokens };
}

export const DEFAULT_TOKENS: ThemeTokens = {
  spacing: ["none", "xs", "sm", "md", "lg", "xl"],
  widths: ["content", "wide", "full"],
  columns: [1, 2, 3, 4],
  colors: ["primary", "secondary", "muted", "accent", "surface", "text"],
  breakpoints: ["mobile", "tablet", "desktop"],
};

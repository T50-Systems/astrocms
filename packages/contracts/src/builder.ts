import { z } from "zod";
import { idSchema } from "./common.js";

/** Tipos de campo del sistema declarativo (extensible con 'plugin:*'). */
export const fieldTypeSchema = z.string().min(1);
export type FieldType =
  | "text" | "textarea" | "richText" | "number" | "boolean"
  | "select" | "multiSelect" | "date" | "dateTime"
  | "colorToken" | "spacingToken" | "url" | "slug"
  | "media" | "gallery" | "relation" | "taxonomy"
  | "object" | "repeater" | "blocks" | "json"
  | (string & {});

export const serializedFieldSchema = z.object({
  key: z.string(),
  type: fieldTypeSchema,
  label: z.string(),
  required: z.boolean(),
  config: z.record(z.unknown()),
});
export type SerializedField = z.infer<typeof serializedFieldSchema>;

// --- Referencias tipadas dentro de props (nunca URLs/HTML crudos) ---
export const mediaRefSchema = z.object({ kind: z.literal("media"), assetId: idSchema });
export type MediaRef = z.infer<typeof mediaRefSchema>;

export const entityRefSchema = z.object({
  kind: z.literal("entity"),
  contentTypeKey: z.string(),
  entryId: idSchema,
});
export type EntityRef = z.infer<typeof entityRefSchema>;

// --- Documento como árbol JSON ---
const baseNode = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  version: z.number().int().positive(),
  props: z.record(z.unknown()),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
});
export type BuilderNode = z.infer<typeof baseNode> & { children: BuilderNode[] };
export const builderNodeSchema: z.ZodType<BuilderNode> = baseNode.extend({
  children: z.lazy(() => builderNodeSchema.array()),
});

export const builderDocumentSchema = z.object({
  id: idSchema,
  schemaVersion: z.number().int().positive(),
  root: builderNodeSchema,
  meta: z
    .object({
      title: z.string().optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
    })
    .optional(),
});
export type BuilderDocument = z.infer<typeof builderDocumentSchema>;

// --- Manifiesto (lo único que ve el panel: esquema + metadatos, NUNCA el componente) ---
export const blockConstraintsSchema = z.object({
  allowedParents: z.array(z.string()).optional(),
  allowedChildren: z.array(z.string()).optional(),
  minChildren: z.number().int().nonnegative().optional(),
  maxChildren: z.number().int().nonnegative().optional(),
});
export type BlockConstraints = z.infer<typeof blockConstraintsSchema>;

export const blockCapabilitiesSchema = z.object({
  acceptsChildren: z.boolean(),
  duplicable: z.boolean(),
  removable: z.boolean(),
  hideable: z.boolean(),
  permission: z.string().optional(),
});
export type BlockCapabilities = z.infer<typeof blockCapabilitiesSchema>;

export const blockDefinitionSerializedSchema = z.object({
  type: z.string(),
  label: z.string(),
  category: z.string(),
  icon: z.string().optional(),
  version: z.number().int().positive(),
  fields: z.array(serializedFieldSchema),
  defaults: z.record(z.unknown()),
  constraints: blockConstraintsSchema,
  capabilities: blockCapabilitiesSchema,
  hasPreviewComponent: z.boolean(),
});
export type BlockDefinitionSerialized = z.infer<typeof blockDefinitionSerializedSchema>;

export const themeTokensSchema = z.object({
  spacing: z.array(z.string()),
  widths: z.array(z.string()),
  columns: z.array(z.number()),
  colors: z.array(z.string()),
  breakpoints: z.array(z.object({ name: z.string().min(1), width: z.number().int().positive().optional() })),
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const blockManifestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  blocks: z.array(blockDefinitionSerializedSchema),
  tokens: themeTokensSchema,
});
export type BlockManifest = z.infer<typeof blockManifestSchema>;

// --- Comandos reversibles (único camino de mutación; también API seguro para IA) ---
export const builderCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("insertNode"), parentId: z.string(), index: z.number().int().nonnegative(), node: builderNodeSchema }),
  z.object({ kind: z.literal("removeNode"), nodeId: z.string() }),
  z.object({ kind: z.literal("moveNode"), nodeId: z.string(), toParentId: z.string(), toIndex: z.number().int().nonnegative() }),
  z.object({ kind: z.literal("duplicateNode"), nodeId: z.string() }),
  z.object({ kind: z.literal("setProp"), nodeId: z.string(), path: z.string(), value: z.unknown() }),
  z.object({ kind: z.literal("setHidden"), nodeId: z.string(), hidden: z.boolean() }),
  z.object({ kind: z.literal("setLocked"), nodeId: z.string(), locked: z.boolean() }),
]);
export type BuilderCommand = z.infer<typeof builderCommandSchema>;

export const builderRevisionSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  createdBy: idSchema,
  note: z.string().optional(),
  isPublished: z.boolean(),
});
export type BuilderRevision = z.infer<typeof builderRevisionSchema>;

export const validationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(
    z.object({
      nodeId: z.string().optional(),
      path: z.string().optional(),
      code: z.string(),
      message: z.string(),
    }),
  ),
});
export type ValidationResult = z.infer<typeof validationResultSchema>;

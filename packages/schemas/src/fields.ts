import { z } from "zod";
import { mediaRefSchema, type FieldType, type SerializedField } from "@astrocms/contracts";

/**
 * Un campo = un descriptor que produce cuatro artefactos desde una sola definición:
 * Zod (validación), valor por defecto, forma serializable (formulario del inspector).
 */
export interface FieldSpec {
  type: FieldType;
  required: boolean;
  label: string;
  toZod(): z.ZodTypeAny;
  defaultValue(): unknown;
  serialize(key: string): SerializedField;
}

export type FieldMap = Record<string, FieldSpec>;

interface Base {
  label: string;
  required?: boolean;
}

function make(
  type: FieldType,
  cfg: Base,
  zod: z.ZodTypeAny,
  def: unknown,
  extra: Record<string, unknown> = {},
): FieldSpec {
  const required = cfg.required ?? false;
  return {
    type,
    required,
    label: cfg.label,
    toZod: () => (required ? zod : zod.optional()),
    defaultValue: () => def,
    serialize: (key) => ({ key, type, label: cfg.label, required, config: extra }),
  };
}

export interface TextConfig extends Base {
  maxLength?: number;
  default?: string;
}
export function text(cfg: TextConfig): FieldSpec {
  let zod = z.string();
  if (cfg.required) zod = zod.min(1, `${cfg.label} es obligatorio`);
  if (cfg.maxLength) zod = zod.max(cfg.maxLength);
  return make("text", cfg, zod, cfg.default ?? "", { maxLength: cfg.maxLength ?? null });
}

export function textarea(cfg: TextConfig): FieldSpec {
  const base = text(cfg);
  return { ...base, type: "textarea", serialize: (k) => ({ ...base.serialize(k), type: "textarea" }) };
}

/** richText: guarda JSON estructurado (Tiptap), no HTML. Aquí, contenido opaco validado como objeto. */
export function richText(cfg: Base): FieldSpec {
  return make("richText", cfg, z.record(z.unknown()), {}, {});
}

export interface NumberConfig extends Base {
  min?: number;
  max?: number;
  default?: number;
}
export function number(cfg: NumberConfig): FieldSpec {
  let zod = z.number();
  if (cfg.min !== undefined) zod = zod.min(cfg.min);
  if (cfg.max !== undefined) zod = zod.max(cfg.max);
  return make("number", cfg, zod, cfg.default ?? 0, { min: cfg.min ?? null, max: cfg.max ?? null });
}

export function boolean(cfg: Base & { default?: boolean }): FieldSpec {
  return make("boolean", cfg, z.boolean(), cfg.default ?? false);
}

export interface SelectConfig extends Base {
  options: string[];
  default?: string;
}
export function select(cfg: SelectConfig): FieldSpec {
  const zod = z.enum(cfg.options as [string, ...string[]]);
  return make("select", cfg, zod, cfg.default ?? cfg.options[0] ?? "", { options: cfg.options });
}

export function url(cfg: Base & { default?: string }): FieldSpec {
  // "" = sin URL (valor vacío legítimo): el default implícito es "" y los defaults
  // se serializan a los props de un nodo recién insertado — un z.string().url()
  // estricto invalidaría el nodo antes de que el editor escriba nada.
  return make("url", cfg, z.union([z.literal(""), z.string().url()]), cfg.default ?? "");
}

export function slug(cfg: Base & { default?: string }): FieldSpec {
  const zod = z.string().regex(/^\/[a-z0-9\-/]*$/i, "slug inválido");
  return make("slug", cfg, zod, cfg.default ?? "/");
}

/** media: referencia por assetId (nunca URL). */
export function media(cfg: Base): FieldSpec {
  return make("media", cfg, mediaRefSchema, undefined);
}

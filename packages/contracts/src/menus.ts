import { z } from "zod";
import { idSchema } from "./common.js";

export const menuItemLinkTypeSchema = z.enum(["entry", "url", "custom"]);
export type MenuItemLinkType = z.infer<typeof menuItemLinkTypeSchema>;

export const menuItemTargetSchema = z.enum(["_self", "_blank"]);
export type MenuItemTarget = z.infer<typeof menuItemTargetSchema>;

export interface MenuItemInput {
  id?: string | undefined;
  label: string;
  linkType: MenuItemLinkType;
  entryId?: string | undefined;
  url?: string | undefined;
  target?: MenuItemTarget | undefined;
  /** Avanzado (estilo WordPress, persistido en menu_items.meta). */
  cssClasses?: string[] | undefined;
  titleAttr?: string | undefined;
  description?: string | undefined;
  children?: MenuItemInput[] | undefined;
}

export const menuItemInputSchema: z.ZodType<MenuItemInput> = z.object({
  id: idSchema.optional(),
  label: z.string().min(1),
  linkType: menuItemLinkTypeSchema,
  entryId: idSchema.optional(),
  url: z.string().optional(),
  target: menuItemTargetSchema.optional(),
  cssClasses: z.array(z.string()).optional(),
  titleAttr: z.string().optional(),
  description: z.string().optional(),
  children: z.array(z.lazy(() => menuItemInputSchema)).optional(),
});

export type MenuItem = {
  id: string;
  label: string;
  linkType: MenuItemLinkType;
  entryId?: string | undefined;
  /**
   * Para linkType "entry", el servidor la CALCULA desde el slug del entry
   * (se ignora en el upsert para ese linkType). Para "url"/"custom" es la del usuario.
   */
  url?: string | undefined;
  target?: MenuItemTarget | undefined;
  /** Read-only, calculado: el entry enlazado ya no existe (como `invalid` en WordPress). */
  invalid?: boolean | undefined;
  /** Avanzado (estilo WordPress, persistido en menu_items.meta). */
  cssClasses?: string[] | undefined;
  titleAttr?: string | undefined;
  description?: string | undefined;
  children: MenuItem[];
};

// Nota de diseño: linkType "term" (categorías como items, estilo WordPress) queda
// descartado por ahora: astro-demo no tiene páginas de archivo de taxonomías
// (solo [...slug], /b/[id]); reconsiderar cuando existan rutas de archivo.
export const menuItemSchema: z.ZodType<MenuItem> = z.object({
  id: idSchema,
  label: z.string(),
  linkType: menuItemLinkTypeSchema,
  entryId: idSchema.optional(),
  url: z.string().optional(),
  target: menuItemTargetSchema.optional(),
  invalid: z.boolean().optional(),
  cssClasses: z.array(z.string()).optional(),
  titleAttr: z.string().optional(),
  description: z.string().optional(),
  children: z.array(z.lazy(() => menuItemSchema)),
});

export const menuSchema = z.object({
  location: z.string().min(1),
  name: z.string().min(1),
  items: z.array(menuItemSchema),
});
export type Menu = z.infer<typeof menuSchema>;

export const upsertMenuRequestSchema = z.object({
  name: z.string().min(1),
  items: z.array(menuItemInputSchema).default([]),
});
export type UpsertMenuRequest = z.infer<typeof upsertMenuRequestSchema>;

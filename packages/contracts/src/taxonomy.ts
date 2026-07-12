import { z } from "zod";
import { idSchema } from "./common.js";

export const taxonomySchema = z.object({
  id: idSchema,
  key: z.string().min(1),
  name: z.string().min(1),
  hierarchical: z.boolean(),
});
export type Taxonomy = z.infer<typeof taxonomySchema>;

export const termRefSchema = z.object({
  id: idSchema,
  taxonomyId: idSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});
export type TermRef = z.infer<typeof termRefSchema>;

export type Term = TermRef & {
  parentId?: string | undefined;
  position: number;
  count: number;
  children?: Term[] | undefined;
};

export const termSchema: z.ZodType<Term> = termRefSchema.extend({
  parentId: idSchema.optional(),
  position: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
  children: z.lazy(() => z.array(termSchema)).optional(),
});

export const taxonomyDetailSchema = taxonomySchema.extend({
  terms: z.array(termSchema),
});
export type TaxonomyDetail = z.infer<typeof taxonomyDetailSchema>;

export const upsertTermRequestSchema = z.object({
  // slug opcional: si falta, el servidor lo deriva del nombre y lo hace único (como WordPress).
  slug: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: idSchema.optional(),
  position: z.number().int().nonnegative().optional(),
});
export type UpsertTermRequest = z.infer<typeof upsertTermRequestSchema>;

export const setEntryTermsRequestSchema = z.object({
  termIds: z.array(idSchema),
});
export type SetEntryTermsRequest = z.infer<typeof setEntryTermsRequestSchema>;

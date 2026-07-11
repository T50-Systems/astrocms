import { and, asc, eq, inArray } from "drizzle-orm";
import type { Taxonomy, Term, TermRef, UpsertTermRequest } from "@astrocms/contracts";
import { entries, termRelationships, terms, taxonomies } from "@astrocms/cms-database";
import type { Database } from "@astrocms/cms-database";
import { notFound, validation } from "./errors.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0] | Database;
type TaxonomyRow = typeof taxonomies.$inferSelect;
type TermRow = typeof terms.$inferSelect;

function toTaxonomy(row: TaxonomyRow): Taxonomy {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    hierarchical: row.hierarchical,
  };
}

function toTerm(row: TermRow, children: Term[]): Term {
  return {
    id: row.id,
    taxonomyId: row.taxonomyId,
    slug: row.slug,
    name: row.name,
    ...(row.parentId ? { parentId: row.parentId } : {}),
    position: row.position,
    ...(children.length > 0 ? { children } : {}),
  };
}

function buildTermTree(rows: TermRow[], parentId: string | null): Term[] {
  return rows
    .filter((row) => row.parentId === parentId)
    .map((row) => toTerm(row, buildTermTree(rows, row.id)));
}

async function assertParent(tx: Tx, taxonomyId: string, parentId: string | undefined): Promise<void> {
  if (!parentId) return;
  const parent = (
    await tx
      .select({ id: terms.id })
      .from(terms)
      .where(and(eq(terms.id, parentId), eq(terms.taxonomyId, taxonomyId)))
      .limit(1)
  )[0];
  if (!parent) throw validation("parentId no pertenece a la taxonomía");
}

export function createTaxonomyService(db: Database) {
  return {
    async listTaxonomies(siteId: string): Promise<Taxonomy[]> {
      const rows = await db
        .select()
        .from(taxonomies)
        .where(eq(taxonomies.siteId, siteId))
        .orderBy(asc(taxonomies.key));
      return rows.map(toTaxonomy);
    },

    async getTaxonomy(siteId: string, key: string): Promise<Taxonomy> {
      const row = (
        await db
          .select()
          .from(taxonomies)
          .where(and(eq(taxonomies.siteId, siteId), eq(taxonomies.key, key)))
          .limit(1)
      )[0];
      if (!row) throw notFound(`taxonomía '${key}' no existe`);
      return toTaxonomy(row);
    },

    async listTerms(taxonomyId: string): Promise<Term[]> {
      const rows = await db
        .select()
        .from(terms)
        .where(eq(terms.taxonomyId, taxonomyId))
        .orderBy(asc(terms.position), asc(terms.name));
      return buildTermTree(rows, null);
    },

    async upsertTerm(input: UpsertTermRequest & { taxonomyId: string }): Promise<Term> {
      await assertParent(db, input.taxonomyId, input.parentId);
      const existing = (
        await db
          .select()
          .from(terms)
          .where(and(eq(terms.taxonomyId, input.taxonomyId), eq(terms.slug, input.slug)))
          .limit(1)
      )[0];

      const parentId = input.parentId ?? null;
      const position = input.position ?? 0;
      const row =
        existing ??
        (
          await db
            .insert(terms)
            .values({ taxonomyId: input.taxonomyId, slug: input.slug, name: input.name, parentId, position })
            .returning()
        )[0]!;

      if (existing) {
        await db
          .update(terms)
          .set({ name: input.name, parentId, position })
          .where(eq(terms.id, existing.id));
      }

      return toTerm({ ...row, name: input.name, parentId, position }, []);
    },

    async assignTerms(entryId: string, termIds: string[]): Promise<TermRef[]> {
      const uniqueTermIds = [...new Set(termIds)];
      await db.transaction(async (tx) => {
        const entry = (await tx.select({ id: entries.id }).from(entries).where(eq(entries.id, entryId)).limit(1))[0];
        if (!entry) throw notFound("entry no existe");

        if (uniqueTermIds.length > 0) {
          const found = await tx.select({ id: terms.id }).from(terms).where(inArray(terms.id, uniqueTermIds));
          if (found.length !== uniqueTermIds.length) throw validation("termIds contiene términos inválidos");
        }

        await tx.delete(termRelationships).where(eq(termRelationships.entryId, entryId));
        if (uniqueTermIds.length > 0) {
          await tx.insert(termRelationships).values(uniqueTermIds.map((termId) => ({ termId, entryId })));
        }
      });
      return this.termsForEntry(entryId);
    },

    async termsForEntry(entryId: string): Promise<TermRef[]> {
      const rows = await db
        .select({
          id: terms.id,
          taxonomyId: terms.taxonomyId,
          slug: terms.slug,
          name: terms.name,
        })
        .from(termRelationships)
        .innerJoin(terms, eq(termRelationships.termId, terms.id))
        .where(eq(termRelationships.entryId, entryId))
        .orderBy(asc(terms.name));
      return rows.map((row) => ({
        id: row.id,
        taxonomyId: row.taxonomyId,
        slug: row.slug,
        name: row.name,
      }));
    },
  };
}

export type TaxonomyService = ReturnType<typeof createTaxonomyService>;

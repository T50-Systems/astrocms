import { and, asc, eq, inArray } from "drizzle-orm";
import type { Menu, MenuItem, MenuItemInput, UpsertMenuRequest } from "@astrocms/contracts";
import { entries, menuItems, menus } from "@astrocms/cms-database";
import type { Database } from "@astrocms/cms-database";
import { notFound } from "./errors.js";
import type { Clock } from "./ports.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0] | Database;
type MenuRow = typeof menus.$inferSelect;
type MenuItemRow = typeof menuItems.$inferSelect;

/** slugs de los entries enlazados, para resolver url y detectar enlaces rotos. */
type EntrySlugs = Map<string, string>;

function toMenuItem(row: MenuItemRow, children: MenuItem[], slugs: EntrySlugs): MenuItem {
  const base = {
    id: row.id,
    label: row.label,
    linkType: row.linkType,
    ...(row.entryId ? { entryId: row.entryId } : {}),
    ...(row.target ? { target: row.target } : {}),
    children,
  };
  if (row.linkType === "entry") {
    // url calculada desde el slug del entry; si no existe (FK set null o borrado), enlace roto.
    const slug = row.entryId ? slugs.get(row.entryId) : undefined;
    return slug ? { ...base, url: slug } : { ...base, invalid: true };
  }
  return { ...base, ...(row.url ? { url: row.url } : {}) };
}

function buildTree(rows: MenuItemRow[], parentId: string | null, slugs: EntrySlugs): MenuItem[] {
  return rows
    .filter((row) => row.parentId === parentId)
    .map((row) => toMenuItem(row, buildTree(rows, row.id, slugs), slugs));
}

async function insertItems(tx: Tx, menuId: string, parentId: string | null, items: MenuItemInput[]): Promise<void> {
  for (const [position, item] of items.entries()) {
    const inserted = (
      await tx
        .insert(menuItems)
        .values({
          ...(item.id ? { id: item.id } : {}),
          menuId,
          parentId,
          position,
          label: item.label,
          linkType: item.linkType,
          entryId: item.entryId ?? null,
          url: item.url ?? null,
          target: item.target ?? null,
        })
        .returning({ id: menuItems.id })
    )[0]!;
    await insertItems(tx, menuId, inserted.id, item.children ?? []);
  }
}

export function createMenuService(db: Database, clock: Clock) {
  async function menuByLocation(siteId: string, location: string): Promise<MenuRow> {
    const row = (
      await db
        .select()
        .from(menus)
        .where(and(eq(menus.siteId, siteId), eq(menus.location, location)))
        .limit(1)
    )[0];
    if (!row) throw notFound(`menú '${location}' no existe`);
    return row;
  }

  async function toMenu(row: MenuRow): Promise<Menu> {
    const rows = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.menuId, row.id))
      .orderBy(asc(menuItems.position), asc(menuItems.createdAt));
    // Batch: slugs de todos los entries enlazados (guard: inArray lanza con lista vacía).
    const entryIds = [...new Set(rows.filter((r) => r.linkType === "entry" && r.entryId).map((r) => r.entryId!))];
    const slugs: EntrySlugs = new Map();
    if (entryIds.length > 0) {
      const found = await db.select({ id: entries.id, slug: entries.slug }).from(entries).where(inArray(entries.id, entryIds));
      for (const e of found) slugs.set(e.id, e.slug);
    }
    return { location: row.location, name: row.name, items: buildTree(rows, null, slugs) };
  }

  return {
    async list(siteId: string): Promise<Menu[]> {
      const rows = await db.select().from(menus).where(eq(menus.siteId, siteId)).orderBy(asc(menus.location));
      return Promise.all(rows.map((row) => toMenu(row)));
    },

    async getByLocation(siteId: string, location: string): Promise<Menu> {
      return toMenu(await menuByLocation(siteId, location));
    },

    async upsert(siteId: string, location: string, input: UpsertMenuRequest): Promise<Menu> {
      await db.transaction(async (tx) => {
        const existing = (
          await tx
            .select()
            .from(menus)
            .where(and(eq(menus.siteId, siteId), eq(menus.location, location)))
            .limit(1)
        )[0];
        const row =
          existing ??
          (
            await tx
              .insert(menus)
              .values({ siteId, location, name: input.name, updatedAt: clock.now() })
              .returning()
          )[0]!;
        if (existing) {
          await tx.update(menus).set({ name: input.name, updatedAt: clock.now() }).where(eq(menus.id, row.id));
          await tx.delete(menuItems).where(eq(menuItems.menuId, row.id));
        }
        await insertItems(tx, row.id, null, input.items);
      });
      return this.getByLocation(siteId, location);
    },
  };
}

export type MenuService = ReturnType<typeof createMenuService>;

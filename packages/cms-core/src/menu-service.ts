import { and, asc, eq } from "drizzle-orm";
import type { Menu, MenuItem, MenuItemInput, UpsertMenuRequest } from "@astrocms/contracts";
import { menuItems, menus } from "@astrocms/cms-database";
import type { Database } from "@astrocms/cms-database";
import { notFound } from "./errors.js";
import type { Clock } from "./ports.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0] | Database;
type MenuRow = typeof menus.$inferSelect;
type MenuItemRow = typeof menuItems.$inferSelect;

function toMenuItem(row: MenuItemRow, children: MenuItem[]): MenuItem {
  return {
    id: row.id,
    label: row.label,
    linkType: row.linkType,
    ...(row.entryId ? { entryId: row.entryId } : {}),
    ...(row.url ? { url: row.url } : {}),
    ...(row.target ? { target: row.target } : {}),
    children,
  };
}

function buildTree(rows: MenuItemRow[], parentId: string | null): MenuItem[] {
  return rows
    .filter((row) => row.parentId === parentId)
    .map((row) => toMenuItem(row, buildTree(rows, row.id)));
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
    return { location: row.location, name: row.name, items: buildTree(rows, null) };
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

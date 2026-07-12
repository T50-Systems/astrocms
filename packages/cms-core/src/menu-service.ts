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

/** Lee las propiedades avanzadas de menu_items.meta con parseo defensivo (jsonb sin forma garantizada). */
function advancedFromMeta(meta: unknown): Pick<MenuItem, "cssClasses" | "titleAttr" | "description"> {
  if (!meta || typeof meta !== "object") return {};
  const rec = meta as Record<string, unknown>;
  const cssClasses = Array.isArray(rec.cssClasses) ? rec.cssClasses.filter((c): c is string => typeof c === "string") : [];
  return {
    ...(cssClasses.length > 0 ? { cssClasses } : {}),
    ...(typeof rec.titleAttr === "string" && rec.titleAttr ? { titleAttr: rec.titleAttr } : {}),
    ...(typeof rec.description === "string" && rec.description ? { description: rec.description } : {}),
  };
}

function toMenuItem(row: MenuItemRow, children: MenuItem[], slugs: EntrySlugs): MenuItem {
  const base = {
    id: row.id,
    label: row.label,
    linkType: row.linkType,
    ...(row.entryId ? { entryId: row.entryId } : {}),
    ...(row.target ? { target: row.target } : {}),
    ...advancedFromMeta(row.meta),
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
          // Para linkType=entry la url siempre se calcula del slug: no persistir la del cliente.
          url: item.linkType === "entry" ? null : item.url ?? null,
          target: item.target ?? null,
          meta: {
            ...(item.cssClasses?.length ? { cssClasses: item.cssClasses } : {}),
            ...(item.titleAttr ? { titleAttr: item.titleAttr } : {}),
            ...(item.description ? { description: item.description } : {}),
          },
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
    return { location: row.location, name: row.name, autoAddPages: row.autoAddPages, items: buildTree(rows, null, slugs) };
  }

  return {
    async list(siteId: string): Promise<Menu[]> {
      const rows = await db.select().from(menus).where(eq(menus.siteId, siteId)).orderBy(asc(menus.location));
      return Promise.all(rows.map((row) => toMenu(row)));
    },

    async getByLocation(siteId: string, location: string): Promise<Menu> {
      return toMenu(await menuByLocation(siteId, location));
    },

    /**
     * "Auto add pages" estilo WordPress: al publicarse una página de nivel
     * superior (slug /algo, sin anidar, y no la home "/"), se añade como item
     * raíz a todos los menús del site con autoAddPages=true.
     * Dedupe por entryId: re-publicar no duplica (y si se quitó a mano, se
     * re-añade solo tras unpublish+publish — comportamiento próximo a WP).
     * Tolerante: nunca lanza (no debe romper la publicación ni el webhook).
     */
    async autoAddEntry(siteId: string, entry: { id?: unknown; slug?: unknown; title?: unknown; contentTypeKey?: unknown }): Promise<void> {
      try {
        if (typeof entry.id !== "string" || typeof entry.slug !== "string" || typeof entry.title !== "string") return;
        if (entry.contentTypeKey !== "page") return;
        if (!/^\/[^/]+$/.test(entry.slug)) return; // solo nivel superior (excluye "/" y anidadas)

        const targets = await db
          .select({ id: menus.id })
          .from(menus)
          .where(and(eq(menus.siteId, siteId), eq(menus.autoAddPages, true)));
        for (const menu of targets) {
          const dupe = (
            await db
              .select({ id: menuItems.id })
              .from(menuItems)
              .where(and(eq(menuItems.menuId, menu.id), eq(menuItems.entryId, entry.id)))
              .limit(1)
          )[0];
          if (dupe) continue;
          const count = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.menuId, menu.id));
          await db.insert(menuItems).values({
            menuId: menu.id,
            parentId: null,
            position: count.length,
            label: entry.title,
            linkType: "entry",
            entryId: entry.id,
            url: null,
            target: null,
            meta: {},
          });
        }
      } catch {
        // nunca romper la publicación por el auto-add
      }
    },

    async remove(siteId: string, location: string): Promise<void> {
      const row = await menuByLocation(siteId, location); // 404 si no existe
      await db.delete(menus).where(eq(menus.id, row.id)); // cascade borra menu_items
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
              .values({ siteId, location, name: input.name, autoAddPages: input.autoAddPages ?? false, updatedAt: clock.now() })
              .returning()
          )[0]!;
        if (existing) {
          await tx
            .update(menus)
            .set({
              name: input.name,
              // Solo si viene definido: clientes viejos no resetean el flag.
              ...(input.autoAddPages !== undefined ? { autoAddPages: input.autoAddPages } : {}),
              updatedAt: clock.now(),
            })
            .where(eq(menus.id, row.id));
          await tx.delete(menuItems).where(eq(menuItems.menuId, row.id));
        }
        await insertItems(tx, row.id, null, input.items);
      });
      return this.getByLocation(siteId, location);
    },
  };
}

export type MenuService = ReturnType<typeof createMenuService>;

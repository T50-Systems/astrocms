import type { MenuItemInput } from "@astrocms/contracts";

/**
 * Helpers puros e inmutables sobre el árbol de items de menú.
 * Los items se direccionan por `path`: índices desde la raíz (p. ej. [1, 0] =
 * primer hijo del segundo item raíz).
 */

type Items = MenuItemInput[];

const childrenOf = (item: MenuItemInput): Items => item.children ?? [];

/** Reemplaza la lista de hermanos ubicada en `parentPath` aplicando `fn`. */
function updateSiblings(items: Items, parentPath: number[], fn: (siblings: Items) => Items): Items {
  if (parentPath.length === 0) return fn(items);
  const [head, ...rest] = parentPath as [number, ...number[]];
  return items.map((item, i) => (i === head ? { ...item, children: updateSiblings(childrenOf(item), rest, fn) } : item));
}

export function getAt(items: Items, path: number[]): MenuItemInput | undefined {
  let list = items;
  let node: MenuItemInput | undefined;
  for (const idx of path) {
    node = list[idx];
    if (!node) return undefined;
    list = childrenOf(node);
  }
  return node;
}

export function updateAt(items: Items, path: number[], patch: Partial<MenuItemInput>): Items {
  const parent = path.slice(0, -1);
  const idx = path[path.length - 1];
  if (idx === undefined) return items;
  return updateSiblings(items, parent, (sib) => sib.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
}

export function removeAt(items: Items, path: number[]): Items {
  const parent = path.slice(0, -1);
  const idx = path[path.length - 1];
  if (idx === undefined) return items;
  return updateSiblings(items, parent, (sib) => sib.filter((_, i) => i !== idx));
}

/** Mueve el item entre sus hermanos (delta -1 = subir, +1 = bajar). */
export function moveSibling(items: Items, path: number[], delta: number): Items {
  const parent = path.slice(0, -1);
  const idx = path[path.length - 1];
  if (idx === undefined) return items;
  return updateSiblings(items, parent, (sib) => {
    const target = idx + delta;
    const item = sib[idx];
    if (!item || target < 0 || target >= sib.length) return sib;
    const next = [...sib];
    next.splice(idx, 1);
    next.splice(target, 0, item);
    return next;
  });
}

/** Estilo WordPress "bajo el anterior como hijo": el item (con su subárbol) pasa a último hijo del hermano previo. */
export function indent(items: Items, path: number[]): Items {
  const parent = path.slice(0, -1);
  const idx = path[path.length - 1];
  if (idx === undefined || idx === 0) return items; // sin hermano previo: no-op
  return updateSiblings(items, parent, (sib) => {
    const item = sib[idx];
    const prev = sib[idx - 1];
    if (!item || !prev) return sib;
    const next = [...sib];
    next.splice(idx, 1);
    next[idx - 1] = { ...prev, children: [...childrenOf(prev), item] };
    return next;
  });
}

/** El item pasa a ser hermano siguiente de su padre (conserva su subárbol). En raíz: no-op. */
export function outdent(items: Items, path: number[]): Items {
  if (path.length < 2) return items;
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1];
  const grandParentPath = parentPath.slice(0, -1);
  const parentIdx = parentPath[parentPath.length - 1];
  if (idx === undefined || parentIdx === undefined) return items;
  return updateSiblings(items, grandParentPath, (sib) => {
    const parent = sib[parentIdx];
    if (!parent) return sib;
    const kids = childrenOf(parent);
    const item = kids[idx];
    if (!item) return sib;
    const next = [...sib];
    next[parentIdx] = { ...parent, children: kids.filter((_, i) => i !== idx) };
    next.splice(parentIdx + 1, 0, item);
    return next;
  });
}

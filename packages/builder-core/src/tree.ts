import type { BuilderNode } from "@astrocms/contracts";

export type GenId = () => string;

/** Busca un nodo por id (DFS). */
export function findNode(root: BuilderNode, id: string): BuilderNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

/** Devuelve el padre de `id` y su índice, o undefined si es la raíz / no existe. */
export function findParentAndIndex(
  root: BuilderNode,
  id: string,
): { parent: BuilderNode; index: number } | undefined {
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i]!;
    if (child.id === id) return { parent: root, index: i };
    const nested = findParentAndIndex(child, id);
    if (nested) return nested;
  }
  return undefined;
}

/** Reemplaza inmutablemente el nodo `id` por `fn(nodo)`. */
export function updateNode(
  root: BuilderNode,
  id: string,
  fn: (node: BuilderNode) => BuilderNode,
): BuilderNode {
  if (root.id === id) return fn(root);
  return { ...root, children: root.children.map((c) => updateNode(c, id, fn)) };
}

/** Inserta `node` como hijo de `parentId` en `index` (inmutable). */
export function insertChild(
  root: BuilderNode,
  parentId: string,
  index: number,
  node: BuilderNode,
): BuilderNode {
  return updateNode(root, parentId, (parent) => {
    const children = [...parent.children];
    children.splice(Math.max(0, Math.min(index, children.length)), 0, node);
    return { ...parent, children };
  });
}

/** Elimina el nodo `id` (inmutable). No elimina la raíz. */
export function removeNode(root: BuilderNode, id: string): BuilderNode {
  return {
    ...root,
    children: root.children.filter((c) => c.id !== id).map((c) => removeNode(c, id)),
  };
}

/** Clona un subárbol regenerando todos los ids. */
export function cloneWithNewIds(node: BuilderNode, genId: GenId): BuilderNode {
  return {
    ...node,
    id: genId(),
    props: structuredClone(node.props),
    children: node.children.map((c) => cloneWithNewIds(c, genId)),
  };
}

/** Fija un valor en `node.props` siguiendo un path tipo "props.title" o "props.a.b". */
export function setPropAtPath(
  node: BuilderNode,
  path: string,
  value: unknown,
): BuilderNode {
  const parts = path.replace(/^props\.?/, "").split(".").filter(Boolean);
  if (parts.length === 0) return node;
  const props = structuredClone(node.props);
  let cursor: Record<string, unknown> = props;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (typeof cursor[key] !== "object" || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
  return { ...node, props };
}

/** Aplana los ids del árbol (para asserts/preview). */
export function collectNodeIds(root: BuilderNode): string[] {
  return [root.id, ...root.children.flatMap(collectNodeIds)];
}

import type { BuilderCommand, BuilderDocument } from "@astrocms/contracts";
import {
  cloneWithNewIds,
  findNode,
  findParentAndIndex,
  insertChild,
  removeNode,
  setPropAtPath,
  updateNode,
  type GenId,
} from "./tree.js";

/**
 * Aplica un comando de forma inmutable y determinista. Si el comando no es aplicable
 * (nodo inexistente, nodo bloqueado), devuelve el documento sin cambios.
 */
export function applyCommand(doc: BuilderDocument, cmd: BuilderCommand, genId: GenId): BuilderDocument {
  const root = doc.root;

  switch (cmd.kind) {
    case "insertNode":
      return withRoot(doc, insertChild(root, cmd.parentId, cmd.index, cmd.node));

    case "removeNode": {
      const node = findNode(root, cmd.nodeId);
      if (!node || node.locked || node.id === root.id) return doc;
      return withRoot(doc, removeNode(root, cmd.nodeId));
    }

    case "moveNode": {
      const node = findNode(root, cmd.nodeId);
      if (!node || node.locked || node.id === root.id) return doc;
      const removed = removeNode(root, cmd.nodeId);
      return withRoot(doc, insertChild(removed, cmd.toParentId, cmd.toIndex, node));
    }

    case "duplicateNode": {
      const node = findNode(root, cmd.nodeId);
      const loc = findParentAndIndex(root, cmd.nodeId);
      if (!node || !loc) return doc;
      const copy = cloneWithNewIds(node, genId);
      return withRoot(doc, insertChild(root, loc.parent.id, loc.index + 1, copy));
    }

    case "setProp":
      if (!findNode(root, cmd.nodeId)) return doc;
      return withRoot(doc, updateNode(root, cmd.nodeId, (n) => setPropAtPath(n, cmd.path, cmd.value)));

    case "setHidden":
      return withRoot(doc, updateNode(root, cmd.nodeId, (n) => ({ ...n, hidden: cmd.hidden })));

    case "setLocked":
      return withRoot(doc, updateNode(root, cmd.nodeId, (n) => ({ ...n, locked: cmd.locked })));

    default:
      return doc;
  }
}

function withRoot(doc: BuilderDocument, root: BuilderDocument["root"]): BuilderDocument {
  return root === doc.root ? doc : { ...doc, root };
}

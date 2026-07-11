import type {
  BlockDefinitionSerialized,
  BlockManifest,
  BuilderDocument,
  BuilderNode,
  SerializedField,
} from "@astrocms/contracts";
import { canInsert, findNode, findParentAndIndex } from "@astrocms/builder-core";

export function manifestByType(manifest: BlockManifest): Map<string, BlockDefinitionSerialized> {
  return new Map(manifest.blocks.map((block) => [block.type, block]));
}

export function getBlock(manifest: BlockManifest, type: string): BlockDefinitionSerialized | undefined {
  return manifest.blocks.find((block) => block.type === type);
}

export function newNode(block: BlockDefinitionSerialized): BuilderNode {
  return {
    id: makeId(),
    type: block.type,
    version: block.version,
    props: structuredClone(block.defaults),
    children: [],
  };
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "n_" + Math.random().toString(36).slice(2);
}

export function insertionParentId(doc: BuilderDocument, manifest: BlockManifest, selectedId: string | null, childType: string): string {
  const selected = selectedId ? findNode(doc.root, selectedId) : undefined;
  if (selected && canInsert(manifest, selected.type, childType)) return selected.id;
  if (canInsert(manifest, doc.root.type, childType)) return doc.root.id;
  const loc = selectedId ? findParentAndIndex(doc.root, selectedId) : undefined;
  if (loc && canInsert(manifest, loc.parent.type, childType)) return loc.parent.id;
  return doc.root.id;
}

export function childIndex(parent: BuilderNode): number {
  return parent.children.length;
}

export function valueAt(node: BuilderNode, field: SerializedField): unknown {
  return node.props[field.key] ?? undefined;
}

export function optionList(field: SerializedField): string[] {
  const options = field.config["options"];
  return Array.isArray(options) ? options.filter((item): item is string => typeof item === "string") : [];
}

export function isMediaRef(value: unknown): value is { kind: "media"; assetId: string } {
  return typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "media";
}

export function findMoveTarget(
  doc: BuilderDocument,
  manifest: BlockManifest,
  activeId: string,
  overId: string,
): { parentId: string; index: number } | undefined {
  if (activeId === overId || activeId === doc.root.id) return undefined;
  const active = findNode(doc.root, activeId);
  const activeLoc = findParentAndIndex(doc.root, activeId);
  const overLoc = findParentAndIndex(doc.root, overId);
  if (!active || !activeLoc || !overLoc) return undefined;
  if (activeLoc.parent.id !== overLoc.parent.id) return undefined;
  if (!canInsert(manifest, overLoc.parent.type, active.type)) return undefined;
  const index = activeLoc.index < overLoc.index ? overLoc.index : overLoc.index;
  return { parentId: overLoc.parent.id, index };
}

export function allNodeIds(node: BuilderNode): string[] {
  return [node.id, ...node.children.flatMap(allNodeIds)];
}

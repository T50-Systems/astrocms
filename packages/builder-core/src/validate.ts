import type {
  BlockDefinitionSerialized,
  BlockManifest,
  BuilderDocument,
  BuilderNode,
  ValidationResult,
} from "@astrocms/contracts";

type Issue = ValidationResult["issues"][number];

/** Valida el documento contra el manifiesto: tipos, constraints y campos requeridos. */
export function validateDocument(doc: BuilderDocument, manifest: BlockManifest): ValidationResult {
  const byType = new Map<string, BlockDefinitionSerialized>(manifest.blocks.map((b) => [b.type, b]));
  const issues: Issue[] = [];
  walk(doc.root, null, byType, issues);
  return { valid: issues.length === 0, issues };
}

function walk(
  node: BuilderNode,
  parentType: string | null,
  byType: Map<string, BlockDefinitionSerialized>,
  issues: Issue[],
): void {
  const isRoot = parentType === null;
  const def = byType.get(node.type);

  if (!def && !isRoot) {
    issues.push({ nodeId: node.id, code: "unknown_block", message: `Bloque desconocido: ${node.type}` });
  }

  if (def) {
    // Campos requeridos presentes.
    for (const field of def.fields) {
      if (!field.required) continue;
      const value = node.props[field.key];
      const missing = value === undefined || value === null || value === "";
      if (missing) {
        issues.push({
          nodeId: node.id,
          path: `props.${field.key}`,
          code: "required_field",
          message: `Campo requerido vacío: ${field.label}`,
        });
      }
    }
    // Hijos no permitidos por capacidad.
    if (!def.capabilities.acceptsChildren && node.children.length > 0) {
      issues.push({ nodeId: node.id, code: "no_children_allowed", message: `${def.label} no acepta hijos` });
    }
    // Constraints de cantidad.
    const c = def.constraints;
    if (c.minChildren !== undefined && node.children.length < c.minChildren) {
      issues.push({ nodeId: node.id, code: "min_children", message: `Requiere ≥${c.minChildren} hijos` });
    }
    if (c.maxChildren !== undefined && node.children.length > c.maxChildren) {
      issues.push({ nodeId: node.id, code: "max_children", message: `Admite ≤${c.maxChildren} hijos` });
    }
    // allowedParents del propio nodo.
    if (parentType && def.constraints.allowedParents && !def.constraints.allowedParents.includes(parentType)) {
      issues.push({ nodeId: node.id, code: "bad_parent", message: `${def.label} no puede ir dentro de ${parentType}` });
    }
  }

  for (const child of node.children) walk(child, node.type, byType, issues);
}

/** ¿Puede `childType` insertarse como hijo de `parentType`? (para dnd). */
export function canInsert(
  manifest: BlockManifest,
  parentType: string,
  childType: string,
): boolean {
  const byType = new Map(manifest.blocks.map((b) => [b.type, b]));
  const parent = byType.get(parentType);
  const child = byType.get(childType);
  if (parent && !parent.capabilities.acceptsChildren) return false;
  if (parent?.constraints.allowedChildren && !parent.constraints.allowedChildren.includes(childType)) return false;
  if (child?.constraints.allowedParents && !child.constraints.allowedParents.includes(parentType)) return false;
  return true;
}

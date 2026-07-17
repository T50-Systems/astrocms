import type { BuilderDocument, BuilderNode } from "@astrocms/contracts";

export interface NodeMigration {
  from: number;
  to: number;
  migrate(props: Record<string, unknown>): Record<string, unknown>;
}

export interface MigrationEntry {
  toVersion: number;
  migrations: NodeMigration[];
}

/** Registro type → migraciones. Lo construye el proyecto/tema (no acopla a schemas). */
export type MigrationRegistry = Map<string, MigrationEntry>;

/** Construye el MigrationRegistry desde definiciones de bloque (shape estructural,
 * sin acoplar a @astrocms/schemas). Solo entran bloques con version > 1 o con
 * migraciones declaradas. */
export interface MigratableBlock {
  type: string;
  version: number;
  migrations?: NodeMigration[];
}

export function registryFromBlocks(blocks: MigratableBlock[]): MigrationRegistry {
  const registry: MigrationRegistry = new Map();
  for (const block of blocks) {
    if (block.version > 1 || (block.migrations?.length ?? 0) > 0) {
      registry.set(block.type, { toVersion: block.version, migrations: block.migrations ?? [] });
    }
  }
  return registry;
}

export interface AppliedMigration {
  nodeId: string;
  type: string;
  from: number;
  to: number;
}

/**
 * Migra cada nodo cuya versión sea menor que la registrada, aplicando en orden las
 * migraciones from→to. Si falta una ruta, deja el nodo como está (el preview emitirá
 * schema-mismatch). Devuelve el documento migrado y la lista de migraciones aplicadas.
 */
export function migrateDocument(
  doc: BuilderDocument,
  registry: MigrationRegistry,
): { document: BuilderDocument; applied: AppliedMigration[] } {
  const applied: AppliedMigration[] = [];
  const root = migrateNode(doc.root, registry, applied);
  return { document: { ...doc, root }, applied };
}

function migrateNode(
  node: BuilderNode,
  registry: MigrationRegistry,
  applied: AppliedMigration[],
): BuilderNode {
  let current = node;
  const entry = registry.get(node.type);
  if (entry && node.version < entry.toVersion) {
    let props = structuredClone(node.props);
    let version = node.version;
    // Aplica cadenas from→to hasta alcanzar toVersion (o hasta que no haya ruta).
    let progressed = true;
    while (version < entry.toVersion && progressed) {
      progressed = false;
      for (const m of entry.migrations) {
        if (m.from === version) {
          props = m.migrate(props);
          applied.push({ nodeId: node.id, type: node.type, from: m.from, to: m.to });
          version = m.to;
          progressed = true;
          break;
        }
      }
    }
    current = { ...node, props, version };
  }
  return { ...current, children: current.children.map((c) => migrateNode(c, registry, applied)) };
}

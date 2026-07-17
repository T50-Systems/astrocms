import { migrateDocument, registryFromBlocks, type MigrationRegistry } from "@astrocms/builder-core";
import type { BuilderDocument } from "@astrocms/contracts";
import { demoBlocks } from "@astrocms/schemas";

const registry = registryFromBlocks(demoBlocks);

/** Migración lazy al leer: devuelve el documento con nodos al día según el
 * catálogo de bloques del servidor. NO persiste (el próximo saveDraft lo hará). */
export function migrateTree(doc: BuilderDocument): BuilderDocument {
  return migrateTreeWith(doc, registry);
}

export function migrateTreeWith(doc: BuilderDocument, migrationRegistry: MigrationRegistry): BuilderDocument {
  return migrateDocument(doc, migrationRegistry).document;
}

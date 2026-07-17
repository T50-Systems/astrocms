import { describe, expect, it } from "vitest";
import type { BuilderDocument } from "@astrocms/contracts";
import type { MigrationRegistry } from "@astrocms/builder-core";
import { migrateTree, migrateTreeWith } from "./builder-migrations.js";

describe("migración lazy del árbol builder", () => {
  it("es no-op seguro para tipos desconocidos y bloques demo v1", () => {
    const document: BuilderDocument = {
      id: "doc-1",
      schemaVersion: 1,
      root: {
        id: "root",
        type: "core/page",
        version: 1,
        props: {},
        children: [
          { id: "heading", type: "core/heading", version: 1, props: { text: "Hola" }, children: [] },
          { id: "unknown", type: "custom/unknown", version: 1, props: {}, children: [] },
        ],
      },
    };

    expect(migrateTree(document)).toEqual(document);
  });

  it("migra un registro sintético de core/heading v1 a v2", () => {
    const document: BuilderDocument = {
      id: "doc-1",
      schemaVersion: 1,
      root: {
        id: "root",
        type: "core/page",
        version: 1,
        props: {},
        children: [{ id: "heading", type: "core/heading", version: 1, props: { text: "Hola" }, children: [] }],
      },
    };
    const registry: MigrationRegistry = new Map([
      ["core/heading", {
        toVersion: 2,
        migrations: [{ from: 1, to: 2, migrate: ({ text, ...props }) => ({ title: text, ...props }) }],
      }],
    ]);

    const migrated = migrateTreeWith(document, registry);
    expect(migrated.root.children[0]).toMatchObject({ version: 2, props: { title: "Hola" } });
    expect(migrated.root.children[0]?.props.text).toBeUndefined();
  });
});

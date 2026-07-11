import { describe, expect, it } from "vitest";
import type { BuilderDocument } from "@astrocms/contracts";
import { migrateDocument, type MigrationRegistry } from "./migrate.js";

describe("builder-core migraciones de bloque", () => {
  it("migra un nodo desactualizado por versión (rename de prop)", () => {
    const doc: BuilderDocument = {
      id: "d1",
      schemaVersion: 1,
      root: {
        id: "root",
        type: "core/page",
        version: 1,
        props: {},
        children: [{ id: "h1", type: "site/hero", version: 1, props: { heading: "Hola" }, children: [] }],
      },
    };
    const registry: MigrationRegistry = new Map([
      [
        "site/hero",
        {
          toVersion: 2,
          migrations: [
            { from: 1, to: 2, migrate: (p) => ({ title: p.heading, ...omit(p, "heading") }) },
          ],
        },
      ],
    ]);

    const { document, applied } = migrateDocument(doc, registry);
    const node = document.root.children[0]!;
    expect(node.version).toBe(2);
    expect(node.props.title).toBe("Hola");
    expect(node.props.heading).toBeUndefined();
    expect(applied).toEqual([{ nodeId: "h1", type: "site/hero", from: 1, to: 2 }]);
  });

  it("deja el nodo intacto si no hay ruta de migración", () => {
    const doc: BuilderDocument = {
      id: "d1",
      schemaVersion: 1,
      root: { id: "root", type: "core/page", version: 1, props: {}, children: [
        { id: "x1", type: "site/unknown", version: 1, props: {}, children: [] },
      ] },
    };
    const { document, applied } = migrateDocument(doc, new Map());
    expect(applied).toHaveLength(0);
    expect(document.root.children[0]?.version).toBe(1);
  });
});

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const { [key]: _drop, ...rest } = obj;
  return rest;
}

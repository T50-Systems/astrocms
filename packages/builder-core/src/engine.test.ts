import { describe, expect, it } from "vitest";
import type { BlockManifest, BuilderDocument, BuilderNode } from "@astrocms/contracts";
import { createEngine } from "./engine.js";
import { collectNodeIds } from "./tree.js";

const manifest: BlockManifest = {
  schemaVersion: 1,
  tokens: { spacing: [], widths: [], columns: [], colors: [], breakpoints: [{ name: "mobile" }, { name: "desktop" }] },
  blocks: [
    {
      type: "site/hero",
      label: "Hero",
      category: "Marketing",
      version: 1,
      fields: [{ key: "title", type: "text", label: "Título", required: true, config: {} }],
      defaults: { title: "" },
      constraints: {},
      capabilities: { acceptsChildren: false, duplicable: true, removable: true, hideable: true },
      hasPreviewComponent: false,
    },
    {
      type: "site/section",
      label: "Sección",
      category: "Layout",
      version: 1,
      fields: [],
      defaults: {},
      constraints: { allowedChildren: ["site/hero"] },
      capabilities: { acceptsChildren: true, duplicable: true, removable: true, hideable: true },
      hasPreviewComponent: false,
    },
  ],
};

function emptyDoc(): BuilderDocument {
  return {
    id: "doc1",
    schemaVersion: 1,
    root: { id: "root", type: "core/page", version: 1, props: {}, children: [] },
  };
}
const hero = (id: string, title = "Hola"): BuilderNode => ({
  id, type: "site/hero", version: 1, props: { title }, children: [],
});

function counterGenId() {
  let i = 0;
  return () => `gen${++i}`;
}

describe("builder-core engine", () => {
  it("inserta y actualiza props", () => {
    const e = createEngine(emptyDoc(), { manifest, genId: counterGenId() });
    e.dispatch({ kind: "insertNode", parentId: "root", index: 0, node: hero("h1") });
    e.dispatch({ kind: "setProp", nodeId: "h1", path: "props.title", value: "Nuevo" });
    expect(e.getState().document.root.children[0]?.props.title).toBe("Nuevo");
  });

  it("undo/redo es determinista (round-trip exacto)", () => {
    const e = createEngine(emptyDoc(), { manifest, genId: counterGenId() });
    e.dispatch({ kind: "insertNode", parentId: "root", index: 0, node: hero("h1", "A") });
    const snapshot = JSON.stringify(e.getState().document);
    e.dispatch({ kind: "setProp", nodeId: "h1", path: "props.title", value: "B" });
    e.undo();
    expect(JSON.stringify(e.getState().document)).toBe(snapshot);
    e.redo();
    expect(e.getState().document.root.children[0]?.props.title).toBe("B");
  });

  it("duplicar genera ids nuevos y coloca la copia tras el original", () => {
    const e = createEngine(emptyDoc(), { manifest, genId: counterGenId() });
    e.dispatch({ kind: "insertNode", parentId: "root", index: 0, node: hero("h1") });
    e.dispatch({ kind: "duplicateNode", nodeId: "h1" });
    const ids = e.getState().document.root.children.map((c) => c.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe("h1");
    expect(ids[1]).not.toBe("h1");
  });

  it("clone regenera ids en profundidad", () => {
    const e = createEngine(emptyDoc(), { manifest, genId: counterGenId() });
    const section: BuilderNode = { id: "s1", type: "site/section", version: 1, props: {}, children: [hero("h1")] };
    e.dispatch({ kind: "insertNode", parentId: "root", index: 0, node: section });
    const copy = e.clone("s1")!;
    const original = collectNodeIds(section);
    const cloned = collectNodeIds(copy);
    expect(cloned.some((id) => original.includes(id))).toBe(false);
  });

  it("no permite borrar un nodo bloqueado", () => {
    const e = createEngine(emptyDoc(), { manifest, genId: counterGenId() });
    e.dispatch({ kind: "insertNode", parentId: "root", index: 0, node: { ...hero("h1"), locked: true } });
    e.dispatch({ kind: "removeNode", nodeId: "h1" });
    expect(e.getState().document.root.children).toHaveLength(1);
  });

  it("validate detecta título requerido vacío y hijos no permitidos", () => {
    const doc = emptyDoc();
    doc.root.children = [
      { ...hero("h1", ""), children: [hero("h2")] }, // vacío + hero no acepta hijos
    ];
    const e = createEngine(doc, { manifest, genId: counterGenId() });
    const result = e.validate();
    expect(result.valid).toBe(false);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain("required_field");
    expect(codes).toContain("no_children_allowed");
  });
});

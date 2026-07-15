import { describe, expect, it } from "vitest";
import type { BlockManifest, BuilderDocument } from "@astrocms/contracts";
import { getBlock, insertionParentId, isMediaRef, newNode, optionList } from "./utils.js";

const manifest: BlockManifest = {
  schemaVersion: 1,
  tokens: { spacing: [], widths: [], columns: [], colors: [], breakpoints: [{ name: "desktop" }] },
  blocks: [
    {
      type: "site/hero",
      label: "Hero",
      category: "Marketing",
      version: 2,
      fields: [
        { key: "title", type: "text", label: "Título", required: true, config: {} },
        { key: "align", type: "select", label: "Alineación", required: false, config: { options: ["left", "center"] } },
      ],
      defaults: { title: "Hola", align: "center" },
      constraints: {},
      capabilities: { acceptsChildren: false, duplicable: true, removable: true, hideable: true },
      hasPreviewComponent: false,
    },
    {
      type: "core/section",
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

const doc: BuilderDocument = {
  id: "d1",
  schemaVersion: 1,
  root: {
    id: "root",
    type: "core/page",
    version: 1,
    props: {},
    children: [{ id: "s1", type: "core/section", version: 1, props: {}, children: [] }],
  },
};

describe("builder-react utils", () => {
  it("newNode clona defaults y fija tipo/versión del manifiesto", () => {
    const node = newNode(getBlock(manifest, "site/hero")!);
    expect(node.type).toBe("site/hero");
    expect(node.version).toBe(2);
    expect(node.props).toEqual({ title: "Hola", align: "center" });
    expect(node.children).toEqual([]);
  });

  it("insertionParentId respeta canInsert (hero va dentro de section, no de hero)", () => {
    // Con la sección seleccionada, el hero entra en la sección.
    expect(insertionParentId(doc, manifest, "s1", "site/hero")).toBe("s1");
    // Sin selección válida, cae a la raíz (core/page acepta cualquier hijo por defecto).
    expect(insertionParentId(doc, manifest, null, "site/hero")).toBe("root");
  });

  it("optionList extrae opciones de select; isMediaRef detecta referencias", () => {
    const heroFields = getBlock(manifest, "site/hero")!.fields;
    const alignField = heroFields.find((f) => f.key === "align")!;
    expect(optionList(alignField)).toEqual(["left", "center"]);
    expect(isMediaRef({ kind: "media", assetId: "a1" })).toBe(true);
    expect(isMediaRef("nope")).toBe(false);
  });
});

import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BlockDefinitionSerialized, BlockManifest, BuilderDocument, BuilderNode } from "@astrocms/contracts";
import { describe, expect, it } from "vitest";
import { Builder } from "./Builder.js";
import { Toolbar } from "./Toolbar.js";
import { Wireframe } from "./Wireframe.js";
import { useBuilder } from "./provider.js";
import { makeAdapter, renderInBuilder } from "./test-utils.js";

const definition = (
  type: string,
  label: string,
  acceptsChildren: boolean,
  allowedChildren?: string[],
  maxChildren?: number,
): BlockDefinitionSerialized => ({
  type,
  label,
  category: acceptsChildren ? "Layout" : "Contenido",
  version: 1,
  fields: [],
  defaults: {},
  constraints: {
    ...(allowedChildren ? { allowedChildren } : {}),
    ...(maxChildren === undefined ? {} : { maxChildren }),
  },
  capabilities: { acceptsChildren, duplicable: type !== "core/page", removable: type !== "core/page", hideable: type !== "core/page" },
  hasPreviewComponent: false,
});

function nestedManifest(maxColumnsChildren?: number): BlockManifest {
  return {
    schemaVersion: 1,
    tokens: { spacing: [], widths: [], columns: [], colors: [], breakpoints: [{ name: "desktop" }, { name: "mobile", width: 390 }] },
    blocks: [
      definition("core/page", "Página", true, ["core/section", "site/hero"]),
      definition("core/section", "Sección", true, ["core/columns", "core/heading", "core/paragraph"]),
      definition("core/columns", "Columnas", true, ["core/heading", "core/paragraph"], maxColumnsChildren),
      definition("site/hero", "Hero", true, ["core/heading", "core/paragraph"]),
      definition("core/heading", "Encabezado", false),
      definition("core/paragraph", "Párrafo", false),
    ],
  };
}

function node(id: string, type: string, children: BuilderNode[] = [], extra: Partial<BuilderNode> = {}): BuilderNode {
  return { id, type, version: 1, props: {}, children, ...extra };
}

function nestedDocument(): BuilderDocument {
  return {
    id: "wireframe-document",
    schemaVersion: 1,
    root: node("root", "core/page", [
      node("section", "core/section", [
        node("columns", "core/columns", [node("heading", "core/heading"), node("paragraph", "core/paragraph")]),
      ]),
      node("hero", "site/hero"),
    ]),
    meta: { title: "Wireframe" },
  };
}

function StateProbe() {
  const { state } = useBuilder();
  return (
    <>
      <output data-testid="selection">{state.selectedNodeId ?? "none"}</output>
      <output data-testid="document-state">{JSON.stringify(state.document)}</output>
    </>
  );
}

function setup(
  ui: React.ReactElement = <><Wireframe /><StateProbe /></>,
  manifest = nestedManifest(),
  document = nestedDocument(),
) {
  return renderInBuilder(ui, { manifest, document, adapter: makeAdapter(document) });
}

describe("Wireframe", () => {
  it("renderiza la jerarquía con labels reales y tonos explícitos por tipo", () => {
    setup();

    expect(screen.getByRole("group", { name: "Página" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Sección" })).toHaveAttribute("data-wireframe-tone", "section");
    expect(screen.getByRole("group", { name: "Columnas" })).toHaveAttribute("data-wireframe-tone", "columns");
    expect(screen.getByRole("group", { name: "Hero" })).toHaveAttribute("data-wireframe-tone", "hero");
    expect(screen.getByRole("group", { name: "Encabezado" })).toHaveAttribute("data-wireframe-tone", "module");
    expect(screen.getByRole("group", { name: "Columnas" })).toContainElement(screen.getByRole("group", { name: "Párrafo" }));
  });

  it("selecciona desde el hit-target de la etiqueta", async () => {
    setup();
    await userEvent.click(within(screen.getByRole("group", { name: "Encabezado" })).getByRole("button", { name: "Encabezado" }));
    expect(screen.getByTestId("selection")).toHaveTextContent("heading");
  });

  it("inserta en parentId/index y selecciona el nodo nuevo", async () => {
    setup();
    const section = screen.getByRole("group", { name: "Sección" });
    const insertAtStart = within(section).getAllByRole("button", { name: "Insertar bloque en posición 1" })[0]!;
    await userEvent.click(insertAtStart);
    await userEvent.click(screen.getByRole("menuitem", { name: "Encabezado" }));

    const document = JSON.parse(screen.getByTestId("document-state").textContent ?? "{}") as BuilderDocument;
    const sectionNode = document.root.children[0]!;
    expect(sectionNode.children[0]?.type).toBe("core/heading");
    expect(screen.getByTestId("selection").textContent).toBe(sectionNode.children[0]?.id);
  });

  it("elimina el seleccionado y limpia selectedNodeId", async () => {
    setup();
    const heading = screen.getByRole("group", { name: "Encabezado" });
    await userEvent.click(within(heading).getByRole("button", { name: "Encabezado" }));
    await userEvent.click(within(heading).getByRole("button", { name: "Eliminar" }));

    expect(screen.queryByRole("group", { name: "Encabezado" })).not.toBeInTheDocument();
    expect(screen.getByTestId("selection")).toHaveTextContent("none");
  });

  it("filtra inserciones por canInsert y maxChildren", async () => {
    setup(undefined, nestedManifest(2));
    const heading = screen.getByRole("group", { name: "Encabezado" });
    expect(within(heading).queryByRole("button", { name: /Insertar bloque/ })).not.toBeInTheDocument();

    const columns = screen.getByRole("group", { name: "Columnas" });
    await userEvent.click(within(columns).getByRole("button", { name: "Insertar bloque en posición 3" }));
    expect(screen.getByText("No se puede insertar nada aquí")).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Sección" })).not.toBeInTheDocument();
  });

  it("duplica y selecciona la copia; locked oculta acciones mutantes", async () => {
    const document = nestedDocument();
    document.root.children[1] = node("hero", "site/hero", [], { locked: true });
    setup(undefined, nestedManifest(), document);

    const heading = screen.getByRole("group", { name: "Encabezado" });
    await userEvent.click(within(heading).getByRole("button", { name: "Duplicar" }));
    const state = JSON.parse(screen.getByTestId("document-state").textContent ?? "{}") as BuilderDocument;
    const copy = state.root.children[0]!.children[0]!.children[1]!;
    expect(copy.type).toBe("core/heading");
    expect(screen.getByTestId("selection")).toHaveTextContent(copy.id);

    const hero = screen.getByRole("group", { name: "Hero" });
    expect(within(hero).queryByRole("button", { name: "Duplicar" })).not.toBeInTheDocument();
    expect(within(hero).queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
  });

  it("reordena con los controles arriba/abajo sin DnD", async () => {
    setup();
    const paragraph = screen.getByRole("group", { name: "Párrafo" });
    await userEvent.click(within(paragraph).getByRole("button", { name: "Más" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Mover arriba" }));

    const document = JSON.parse(screen.getByTestId("document-state").textContent ?? "{}") as BuilderDocument;
    expect(document.root.children[0]!.children[0]!.children.map((child) => child.id)).toEqual(["paragraph", "heading"]);
  });

  it("Mover a… muestra destinos con ubicación y reparentea al final", async () => {
    setup();
    const heading = screen.getByRole("group", { name: "Encabezado" });
    await userEvent.click(within(heading).getByRole("button", { name: "Más" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Mover a…" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Página › Hero" }));

    const document = JSON.parse(screen.getByTestId("document-state").textContent ?? "{}") as BuilderDocument;
    expect(document.root.children[1]!.children.at(-1)?.id).toBe("heading");
    expect(document.root.children[0]!.children[0]!.children.map((child) => child.id)).toEqual(["paragraph"]);
  });

  it("Escape cierra primero el menú y conserva la selección", async () => {
    setup(<><Toolbar /><Wireframe /><StateProbe /></>);
    const heading = screen.getByRole("group", { name: "Encabezado" });
    await userEvent.click(within(heading).getByRole("button", { name: "Encabezado" }));
    await userEvent.click(within(heading).getByRole("button", { name: "Más" }));

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByTestId("selection")).toHaveTextContent("heading");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("selection")).toHaveTextContent("none");
  });

  it("alterna la vista sin desmontar el iframe del canvas", async () => {
    setup(<Builder />);
    const iframe = screen.getByTitle("Builder preview");
    await userEvent.click(screen.getByRole("button", { name: "Wireframe" }));
    // Mismo nodo DOM (no remonta → conserva handshake); oculto por display:none del wrapper.
    expect(screen.getByTitle("Builder preview")).toBe(iframe);
    expect(iframe).not.toBeVisible();
    expect(screen.getByTestId("wireframe-view")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByTitle("Builder preview")).toBe(iframe);
    expect(iframe).toBeVisible();
  });

  it("Mover a… ofrece la raíz aunque el manifiesto no defina core/page (caso producción)", async () => {
    // El manifiesto real (demoBuilderManifest) NO incluye core/page; sin el fixture que lo
    // inventa, la raíz debe seguir siendo un destino de reparenting válido.
    const manifestNoPage: BlockManifest = { ...nestedManifest(), blocks: nestedManifest().blocks.filter((b) => b.type !== "core/page") };
    setup(undefined, manifestNoPage);
    const heading = screen.getByRole("group", { name: "Encabezado" });
    await userEvent.click(within(heading).getByRole("button", { name: "Más" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Mover a…" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Página" }));

    const document = JSON.parse(screen.getByTestId("document-state").textContent ?? "{}") as BuilderDocument;
    // heading se movió al nivel raíz de la página.
    expect(document.root.children.at(-1)?.id).toBe("heading");
  });

  it("Escape cierra el menú aunque el foco haya salido de él (listener window en captura)", async () => {
    setup(<><Toolbar /><Wireframe /><StateProbe /></>);
    const heading = screen.getByRole("group", { name: "Encabezado" });
    await userEvent.click(within(heading).getByRole("button", { name: "Encabezado" }));
    await userEvent.click(within(heading).getByRole("button", { name: "Más" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    // Escape disparado en window (foco fuera del menú): igualmente cierra el menú y NO deselecciona.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByTestId("selection")).toHaveTextContent("heading");
  });
});

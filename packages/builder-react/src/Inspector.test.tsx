import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { Inspector } from "./Inspector.js";
import { useBuilder } from "./provider.js";
import { makeCms, makeManifest, makeMediaAsset, renderInBuilder } from "./test-utils.js";

function SelectHeading() {
  const { engine } = useBuilder();
  useEffect(() => engine.select("heading-1"), [engine]);
  return null;
}

function SelectImage() {
  const { engine } = useBuilder();
  useEffect(() => engine.select("image-1"), [engine]);
  return null;
}

function DocumentState() {
  const { state } = useBuilder();
  return <output data-testid="document-state">{JSON.stringify(state.document)}</output>;
}

describe("Inspector", () => {
  it("genera los campos del bloque seleccionado y actualiza sus props", async () => {
    const user = userEvent.setup();
    renderInBuilder(<><SelectHeading /><Inspector /><DocumentState /></>);

    const text = await screen.findByLabelText("Texto");
    expect(screen.getByLabelText("Nivel")).toHaveValue("h1");
    await user.clear(text);
    await user.type(text, "Título actualizado");

    const heading = JSON.parse(screen.getByTestId("document-state").textContent ?? "{}").root.children[0];
    expect(heading.props).toMatchObject({ text: "Título actualizado", level: "h1" });
  });

  it("mantiene src de core/image como input de URL externa sin botón de biblioteca", async () => {
    const user = userEvent.setup();
    const manifest = makeManifest();
    manifest.blocks.push({
      type: "core/image", label: "Imagen", category: "Contenido", version: 1,
      fields: [{ key: "src", type: "url", label: "URL externa", required: false, config: {} }],
      defaults: { src: "" }, constraints: {},
      capabilities: { acceptsChildren: false, duplicable: true, removable: true, hideable: true }, hasPreviewComponent: false,
    });
    renderInBuilder(<><SelectImage /><Inspector /><DocumentState /></>, {
      cms: makeCms([]),
      manifest,
      document: {
        id: "document-1", schemaVersion: 1,
        root: { id: "root", type: "core/page", version: 1, props: {}, children: [{ id: "image-1", type: "core/image", version: 1, props: { src: "" }, children: [] }] },
        meta: { title: "Documento de prueba" },
      },
    });

    const input = await screen.findByLabelText("URL externa");
    expect(screen.queryByRole("button", { name: "Biblioteca" })).not.toBeInTheDocument();
    await user.type(input, "https://cdn.test/bosque.jpg");

    const image = JSON.parse(screen.getByTestId("document-state").textContent ?? "{}").root.children[0];
    expect(image.props.src).toBe("https://cdn.test/bosque.jpg");
  });

  it("guarda MediaRef al elegir la biblioteca de core/image", async () => {
    const user = userEvent.setup();
    const manifest = makeManifest();
    manifest.blocks.push({
      type: "core/image", label: "Imagen", category: "Contenido", version: 1,
      fields: [{ key: "media", type: "media", label: "Imagen de la biblioteca", required: false, config: {} }],
      defaults: {}, constraints: {},
      capabilities: { acceptsChildren: false, duplicable: true, removable: true, hideable: true }, hasPreviewComponent: false,
    });
    const asset = makeMediaAsset({ id: "asset-media", alt: "Lago" });
    renderInBuilder(<><SelectImage /><Inspector /><DocumentState /></>, {
      cms: makeCms([asset]),
      manifest,
      document: {
        id: "document-1", schemaVersion: 1,
        root: { id: "root", type: "core/page", version: 1, props: {}, children: [{ id: "image-1", type: "core/image", version: 1, props: {}, children: [] }] },
        meta: { title: "Documento de prueba" },
      },
    });

    await user.click(await screen.findByRole("button", { name: "Elegir de la biblioteca" }));
    await user.click(await screen.findByRole("button", { name: "Elegir Lago" }));

    const node = JSON.parse(screen.getByTestId("document-state").textContent ?? "{}").root.children[0];
    expect(node.props.media).toEqual({ kind: "media", assetId: "asset-media" });
  });
});

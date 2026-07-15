import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BlockPanel } from "./BlockPanel.js";
import { renderInBuilder } from "./test-utils.js";
import { useBuilder } from "./provider.js";

function DocumentState() {
  const { state } = useBuilder();
  return <output data-testid="document-state">{JSON.stringify(state.document)}</output>;
}

describe("BlockPanel", () => {
  it("muestra los bloques del manifiesto e inserta el bloque activado", async () => {
    const user = userEvent.setup();
    renderInBuilder(<><BlockPanel /><DocumentState /></>);

    expect(screen.getByTestId("add-block-core/page")).toBeInTheDocument();
    expect(screen.getByTestId("add-block-core/heading")).toBeInTheDocument();
    await user.click(screen.getByTestId("add-block-core/paragraph"));

    expect(JSON.parse(screen.getByTestId("document-state").textContent ?? "{}").root.children).toEqual([
      expect.objectContaining({ id: "heading-1", type: "core/heading" }),
      expect.objectContaining({ type: "core/paragraph", props: { text: "Nuevo párrafo" } }),
    ]);
  });
});

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { Inspector } from "./Inspector.js";
import { useBuilder } from "./provider.js";
import { renderInBuilder } from "./test-utils.js";

function SelectHeading() {
  const { engine } = useBuilder();
  useEffect(() => engine.select("heading-1"), [engine]);
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
});

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useBuilder } from "./provider.js";
import { renderInBuilder } from "./test-utils.js";

function StoreProbe() {
  const { engine, state } = useBuilder();
  return (
    <>
      <button type="button" onClick={() => engine.select("heading-1")}>Seleccionar</button>
      <button
        type="button"
        onClick={() => engine.dispatch({
          kind: "setProp",
          nodeId: "heading-1",
          path: "props.text",
          value: "Actualizado",
        })}
      >
        Actualizar
      </button>
      <output data-testid="selected">{state.selectedNodeId}</output>
      <output data-testid="title">{String(state.document.root.children[0]?.props.text)}</output>
      <output data-testid="can-undo">{String(engine.canUndo())}</output>
    </>
  );
}

describe("BuilderProvider y useBuilder", () => {
  it("sincroniza selección, comandos y el historial expuesto por el motor", async () => {
    const user = userEvent.setup();
    renderInBuilder(<StoreProbe />);

    await user.click(screen.getByRole("button", { name: "Seleccionar" }));
    expect(screen.getByTestId("selected")).toHaveTextContent("heading-1");

    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(screen.getByTestId("title")).toHaveTextContent("Actualizado");
    expect(screen.getByTestId("can-undo")).toHaveTextContent("true");
  });
});

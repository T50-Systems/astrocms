import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NodeTree } from "./NodeTree.js";
import { useBuilder } from "./provider.js";
import { renderInBuilder } from "./test-utils.js";

function Selection() {
  const { state } = useBuilder();
  return <output data-testid="selection">{state.selectedNodeId}</output>;
}

describe("NodeTree", () => {
  it("renderiza el árbol y selecciona el nodo mediante el control sortable", () => {
    renderInBuilder(<><NodeTree /><Selection /></>);

    const nodes = screen.getAllByTestId("tree-node");
    expect(nodes).toHaveLength(2);
    expect(nodes[1]).toHaveAttribute("data-node-type", "core/heading");

    fireEvent.click(nodes[1]!);
    expect(screen.getByTestId("selection")).toHaveTextContent("heading-1");
  });
});

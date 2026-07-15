import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MediaPicker } from "./MediaPicker.js";
import { makeCms, makeMediaAsset, renderInBuilder } from "./test-utils.js";

describe("MediaPicker", () => {
  it("muestra miniaturas y selecciona un asset", async () => {
    const user = userEvent.setup();
    const asset = makeMediaAsset({ alt: "Montaña", filename: "montana.jpg", variants: [{ kind: "thumb", url: "https://cdn.test/montana-thumb.jpg" }] });
    const onClose = vi.fn();
    const onSelect = vi.fn();
    renderInBuilder(<MediaPicker open onClose={onClose} onSelect={onSelect} />, { cms: makeCms([asset]) });

    expect(await screen.findByRole("img", { name: "Montaña" })).toHaveAttribute("src", "https://cdn.test/montana-thumb.jpg");
    await user.click(screen.getByRole("button", { name: "Elegir Montaña" }));

    expect(onSelect).toHaveBeenCalledWith(asset);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

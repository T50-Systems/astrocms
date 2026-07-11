import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "./entry-transitions.js";
import { slugify } from "./ports.js";
import { DomainError } from "./errors.js";

describe("entry transitions (behavior model)", () => {
  it("permite draft→published y published→draft", () => {
    expect(canTransition("draft", "published")).toBe(true);
    expect(canTransition("published", "draft")).toBe(true);
  });

  it("rechaza archived→published", () => {
    expect(canTransition("archived", "published")).toBe(false);
    expect(() => assertTransition("archived", "published")).toThrow(DomainError);
  });

  it("permite transición idempotente (mismo estado)", () => {
    expect(canTransition("published", "published")).toBe(true);
  });
});

describe("slugify", () => {
  it("normaliza acentos y espacios con prefijo '/'", () => {
    expect(slugify("Página de Inicio")).toBe("/pagina-de-inicio");
    expect(slugify("  Hola   Mundo!! ")).toBe("/hola-mundo");
  });
});

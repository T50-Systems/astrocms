import { describe, expect, it } from "vitest";
import {
  createEntryRequestSchema,
  loginRequestSchema,
  slugSchema,
  entrySchema,
} from "./index.js";

describe("contracts", () => {
  it("aplica defaults en createEntryRequest", () => {
    const parsed = createEntryRequestSchema.parse({ title: "Inicio" });
    expect(parsed.contentTypeKey).toBe("page");
    expect(parsed.editorType).toBe("rich-text");
  });

  it("rechaza slug inválido", () => {
    expect(slugSchema.safeParse("sin-barra").success).toBe(false);
    expect(slugSchema.safeParse("/acerca").success).toBe(true);
    expect(slugSchema.safeParse("/").success).toBe(true);
  });

  it("rechaza login sin email válido", () => {
    expect(loginRequestSchema.safeParse({ email: "x", password: "y" }).success).toBe(false);
  });

  it("valida un entry completo (round-trip)", () => {
    const now = new Date("2026-07-10T12:00:00.000Z").toISOString();
    const entry = {
      id: "e1",
      contentTypeKey: "page",
      title: "Inicio",
      slug: "/",
      status: "draft" as const,
      editorType: "rich-text" as const,
      data: {},
      seo: {},
      currentVersionNo: 1,
      authorId: "u1",
      createdAt: now,
      updatedAt: now,
    };
    expect(entrySchema.parse(entry)).toMatchObject({ slug: "/", status: "draft" });
  });
});

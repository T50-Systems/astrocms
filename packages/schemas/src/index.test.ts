import { describe, expect, it } from "vitest";
import { blockDefaults, buildManifest, defineBlock, blockZod, DEFAULT_TOKENS } from "./block.js";
import { demoBlocks, demoBuilderManifest } from "./demo.js";
import { media, richText, select, text, url } from "./fields.js";

const hero = defineBlock({
  type: "site/hero",
  label: "Hero",
  category: "Marketing",
  version: 1,
  component: "./src/components/builder/Hero.astro",
  fields: {
    title: text({ label: "Título", required: true }),
    description: richText({ label: "Descripción" }),
    image: media({ label: "Imagen" }),
    alignment: select({ label: "Alineación", options: ["left", "center", "right"], default: "center" }),
  },
  capabilities: { acceptsChildren: false },
});

describe("schemas / defineBlock", () => {
  it("el manifiesto NO incluye el component del .astro", () => {
    const manifest = buildManifest([hero], DEFAULT_TOKENS);
    const block = manifest.blocks[0]!;
    expect(block).not.toHaveProperty("component");
    expect(block.type).toBe("site/hero");
    expect(block.fields.map((f) => f.key)).toEqual(["title", "description", "image", "alignment"]);
    expect(block.defaults.alignment).toBe("center");
    expect(block.capabilities.duplicable).toBe(true); // default aplicado
  });

  it("blockZod valida props: título requerido, alignment enum", () => {
    const zod = blockZod(hero);
    expect(zod.safeParse({ title: "Hola", alignment: "center", description: {} }).success).toBe(true);
    expect(zod.safeParse({ title: "", alignment: "center" }).success).toBe(false);
    expect(zod.safeParse({ title: "Hola", alignment: "diagonal" }).success).toBe(false);
  });

  it("los defaults de cada bloque demo pasan su propio blockZod (nodo recién insertado válido)", () => {
    // Regresión: url() con default "" invalidaba un core/image recién insertado
    // (los defaults se serializan a props). "" es "sin URL", un valor legítimo.
    for (const block of demoBlocks) {
      const result = blockZod(block).safeParse(blockDefaults(block));
      expect(result.success, `${block.type}: ${JSON.stringify(!result.success && result.error.issues)}`).toBe(true);
    }
    // Una URL malformada sigue rechazándose.
    const image = demoBlocks.find((b) => b.type === "core/image")!;
    expect(blockZod(image).safeParse({ ...blockDefaults(image), src: "no-es-url" }).success).toBe(false);
  });

  it("url(): \"\" es válido solo en campos opcionales; en required se rechaza", () => {
    const optional = defineBlock({ type: "t/opt", label: "Opt", category: "x", version: 1, fields: { href: url({ label: "URL" }) }, component: "" });
    const required = defineBlock({ type: "t/req", label: "Req", category: "x", version: 1, fields: { href: url({ label: "URL", required: true }) }, component: "" });
    expect(blockZod(optional).safeParse({ href: "" }).success).toBe(true);
    expect(blockZod(required).safeParse({ href: "" }).success).toBe(false);
    expect(blockZod(required).safeParse({ href: "https://example.com" }).success).toBe(true);
  });

  it("serializa opciones del select en config", () => {
    const manifest = buildManifest([hero], DEFAULT_TOKENS);
    const alignment = manifest.blocks[0]!.fields.find((f) => f.key === "alignment")!;
    expect(alignment.config.options).toEqual(["left", "center", "right"]);
  });

  it("el manifiesto demo incluye el catalogo ampliado", () => {
    const types = demoBuilderManifest.blocks.map((block) => block.type);
    expect(types).toEqual(
      expect.arrayContaining([
        "core/image",
        "core/quote",
        "core/list",
        "core/divider",
        "core/columns",
        "site/service-grid",
        "site/testimonials",
        "site/cta",
        "site/faq",
      ]),
    );

    const columns = demoBuilderManifest.blocks.find((block) => block.type === "core/columns")!;
    expect(columns.capabilities.acceptsChildren).toBe(true);
    expect(columns.constraints.allowedChildren).toContain("site/cta");

    const image = demoBuilderManifest.blocks.find((block) => block.type === "core/image")!;
    expect(image.version).toBe(1);
    expect(image.fields.map((field) => field.key)).toEqual(["media", "src", "alt"]);
    expect(image.defaults.src).toBe("");
  });
});

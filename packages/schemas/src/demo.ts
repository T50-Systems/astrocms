import { DEFAULT_TOKENS, buildManifest, defineBlock } from "./block.js";
import { number, select, text, textarea } from "./fields.js";

export const demoBlocks = [
  defineBlock({
    type: "site/hero",
    label: "Hero",
    category: "Contenido",
    version: 1,
    component: "src/components/builder/Hero.astro",
    icon: "H",
    fields: {
      title: text({ label: "Titulo", required: true, maxLength: 120, default: "Bienvenido" }),
      description: textarea({
        label: "Descripcion",
        maxLength: 260,
        default: "Edita este texto desde el builder.",
      }),
      alignment: select({ label: "Alineacion", options: ["left", "center", "right"], default: "center" }),
    },
    constraints: { allowedParents: ["core/page", "core/section"] },
    capabilities: { acceptsChildren: true },
  }),
  defineBlock({
    type: "core/section",
    label: "Seccion",
    category: "Layout",
    version: 1,
    component: "src/components/builder/Section.astro",
    icon: "S",
    fields: {
      width: select({ label: "Ancho", options: ["content", "wide", "full"], default: "content" }),
    },
    constraints: { allowedParents: ["core/page", "core/section"] },
    capabilities: { acceptsChildren: true },
  }),
  defineBlock({
    type: "core/heading",
    label: "Titulo",
    category: "Contenido",
    version: 1,
    component: "src/components/builder/Heading.astro",
    icon: "T",
    fields: {
      text: text({ label: "Texto", required: true, maxLength: 140, default: "Nuevo titulo" }),
      level: number({ label: "Nivel", min: 1, max: 3, default: 2 }),
    },
    constraints: { allowedParents: ["core/page", "core/section", "site/hero"] },
  }),
  defineBlock({
    type: "core/paragraph",
    label: "Parrafo",
    category: "Contenido",
    version: 1,
    component: "src/components/builder/Paragraph.astro",
    icon: "P",
    fields: {
      text: textarea({ label: "Texto", maxLength: 500, default: "Nuevo parrafo." }),
    },
    constraints: { allowedParents: ["core/page", "core/section", "site/hero"] },
  }),
  defineBlock({
    type: "core/button",
    label: "Boton",
    category: "Contenido",
    version: 1,
    component: "src/components/builder/Button.astro",
    icon: "B",
    fields: {
      label: text({ label: "Etiqueta", required: true, maxLength: 80, default: "Boton" }),
      href: text({ label: "URL", maxLength: 200, default: "#" }),
    },
    constraints: { allowedParents: ["core/page", "core/section", "site/hero"] },
  }),
];

export const demoBuilderManifest = buildManifest(demoBlocks, DEFAULT_TOKENS);

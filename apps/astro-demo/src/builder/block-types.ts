/**
 * Lista canónica de tipos de bloque que el guest de preview sabe renderizar.
 *
 * Debe coincidir exactamente con los keys de `blockComponents` en `registry.ts`
 * (incluye "core/page", el contenedor raíz, que NO forma parte del manifiesto
 * de bloques de contenido pero SÍ es renderizable por el guest).
 */
export const REGISTERED_BLOCK_TYPES = [
  "core/page",
  "site/hero",
  "core/heading",
  "core/paragraph",
  "core/section",
  "core/button",
  "core/image",
  "core/quote",
  "core/list",
  "core/divider",
  "core/columns",
  "site/service-grid",
  "site/testimonials",
  "site/cta",
  "site/faq",
] as const;

export type RegisteredBlockType = (typeof REGISTERED_BLOCK_TYPES)[number];

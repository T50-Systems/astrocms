import type { RegisteredBlockType } from "./block-types.ts";
import Button from "./blocks/Button.astro";
import Columns from "./blocks/Columns.astro";
import Cta from "./blocks/Cta.astro";
import Divider from "./blocks/Divider.astro";
import Faq from "./blocks/Faq.astro";
import Heading from "./blocks/Heading.astro";
import Hero from "./blocks/Hero.astro";
import Image from "./blocks/Image.astro";
import List from "./blocks/List.astro";
import Page from "./blocks/Page.astro";
import Paragraph from "./blocks/Paragraph.astro";
import Quote from "./blocks/Quote.astro";
import Section from "./blocks/Section.astro";
import ServiceGrid from "./blocks/ServiceGrid.astro";
import Testimonials from "./blocks/Testimonials.astro";

/** Mapa tipo → componente Astro. En un proyecto real lo genera `astrocms generate`. */
const blockComponents = {
  "core/page": Page,
  "site/hero": Hero,
  "core/heading": Heading,
  "core/paragraph": Paragraph,
  "core/section": Section,
  "core/button": Button,
  "core/image": Image,
  "core/quote": Quote,
  "core/list": List,
  "core/divider": Divider,
  "core/columns": Columns,
  "site/service-grid": ServiceGrid,
  "site/testimonials": Testimonials,
  "site/cta": Cta,
  "site/faq": Faq,
} satisfies Record<RegisteredBlockType, typeof Page>;

export function getBlockComponent(type: string): typeof Page | undefined {
  return (blockComponents as Record<string, typeof Page>)[type];
}

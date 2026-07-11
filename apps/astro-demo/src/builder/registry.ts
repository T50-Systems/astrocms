import Button from "./blocks/Button.astro";
import Heading from "./blocks/Heading.astro";
import Hero from "./blocks/Hero.astro";
import Page from "./blocks/Page.astro";
import Paragraph from "./blocks/Paragraph.astro";
import Section from "./blocks/Section.astro";

/** Mapa tipo → componente Astro. En un proyecto real lo genera `astrocms generate`. */
const blockComponents = {
  "core/page": Page,
  "site/hero": Hero,
  "core/heading": Heading,
  "core/paragraph": Paragraph,
  "core/section": Section,
  "core/button": Button,
} satisfies Record<string, typeof Page>;

export function getBlockComponent(type: string): typeof Page | undefined {
  return (blockComponents as Record<string, typeof Page>)[type];
}

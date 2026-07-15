import type { BuilderNode } from "@astrocms/contracts";

export interface PageTemplate {
  id: "blank" | "landing" | "about" | "services";
  name: string;
  description: string;
  defaultTitle: string;
  buildRoot(): BuilderNode;
}

function node(type: string, props: Record<string, unknown>, children: BuilderNode[] = []): BuilderNode {
  return { id: crypto.randomUUID(), type, version: 1, props, children };
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "blank",
    name: "Página en blanco",
    description: "Empieza desde cero.",
    defaultTitle: "Página sin título",
    buildRoot: () => ({ id: "root", type: "core/page", version: 1, props: {}, children: [] }),
  },
  {
    id: "landing",
    name: "Landing",
    description: "Hero, servicios y llamada a la acción.",
    defaultTitle: "Nueva landing",
    buildRoot: () => ({
      id: "root",
      type: "core/page",
      version: 1,
      props: {},
      children: [
        node("site/hero", {
          title: "Haz crecer tu próximo proyecto",
          description: "Una solución clara, cercana y preparada para avanzar contigo.",
          alignment: "center",
        }, [node("core/button", { label: "Conoce nuestros servicios", href: "https://example.com/servicios" })]),
        node("site/service-grid", {
          title: "Todo lo que necesitas para empezar",
          items: "Estrategia|Definimos un plan claro para tus objetivos.\nDiseño|Creamos experiencias que conectan con tu audiencia.\nAcompañamiento|Avanzamos contigo en cada etapa.",
        }),
        node("site/cta", {
          title: "¿Listo para dar el siguiente paso?",
          description: "Cuéntanos qué necesitas y empecemos a trabajar juntos.",
          buttonLabel: "Hablemos",
          buttonHref: "https://example.com/contacto",
        }),
      ],
    }),
  },
  {
    id: "about",
    name: "Sobre nosotros",
    description: "Título, texto e imagen.",
    defaultTitle: "Sobre nosotros",
    buildRoot: () => ({
      id: "root",
      type: "core/page",
      version: 1,
      props: {},
      children: [
        node("core/heading", { text: "Conoce a nuestro equipo", level: 1 }),
        node("core/paragraph", { text: "Somos un equipo comprometido con crear soluciones útiles, honestas y duraderas para las personas que confían en nosotros." }),
        node("core/image", { src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c", alt: "Equipo colaborando en una mesa de trabajo" }),
      ],
    }),
  },
  {
    id: "services",
    name: "Servicios",
    description: "Servicios, preguntas frecuentes y CTA.",
    defaultTitle: "Servicios",
    buildRoot: () => ({
      id: "root",
      type: "core/page",
      version: 1,
      props: {},
      children: [
        node("core/heading", { text: "Servicios pensados para tus objetivos", level: 1 }),
        node("site/service-grid", {
          title: "Cómo podemos ayudarte",
          items: "Consultoría|Analizamos tu reto y trazamos el mejor camino.\nImplementación|Convertimos la estrategia en resultados concretos.\nSoporte continuo|Seguimos a tu lado después del lanzamiento.",
        }),
        node("site/faq", {
          items: "¿Cómo empezamos?|Agenda una conversación para conocer tus necesidades.\n¿Cuánto tarda un proyecto?|Definimos un calendario realista según el alcance.\n¿Pueden trabajar con mi equipo?|Sí, colaboramos de forma cercana y transparente.",
        }),
        node("site/cta", {
          title: "Hablemos de tu proyecto",
          description: "Estamos listos para ayudarte a convertir tus ideas en resultados.",
          buttonLabel: "Solicitar información",
          buttonHref: "https://example.com/contacto",
        }),
      ],
    }),
  },
];

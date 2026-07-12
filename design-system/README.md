# AstroCMS Design System

Tarjetas de especificación del design system, sincronizadas con el proyecto
**"AstroCMS Design System"** en claude.ai/design (herramienta DesignSync).

- **Fuente de verdad del tema**: `apps/cms-admin/src/globals.css` (variables oklch,
  light/dark) + los tokens DTCG del grupo de settings `design-tokens`
  (`color.brand` re-tematiza panel y web vía `DesignTokensBridge` y astro-demo).
- **Componentes reales**: `apps/cms-admin/src/components/ui/*` (shadcn/Radix + cva).
- Estas tarjetas son especímenes HTML autocontenidos (primera línea `@dsCard`)
  que documentan valores y patrones; si cambias el tema o un componente,
  actualiza la tarjeta correspondiente y re-sincroniza (incremental, nunca
  reemplazo total).

Grupos: Colors · Type · Spacing · Brand · Components · Patterns.

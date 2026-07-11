# AstroCMS — Documentación de diseño (Fase 0)

Entregables de definición previos a la implementación. Orden de lectura sugerido:

| # | Documento | Contenido |
|---|-----------|-----------|
| 00 | [Resumen y alcance](00-overview.md) | Problema, supuestos, alcance, no-alcance, principios |
| 01 | [Arquitectura](01-architecture.md) | Estilo, mapa de módulos, despliegue, flujos, fronteras |
| 02 | [Modelo de datos](02-data-model.md) | Tablas PostgreSQL, ER, decisiones de modelado |
| 03 | [Contratos CMS](03-contracts-cms.md) | Tipos TS + SDK + mapa API v1 |
| 04 | [Contratos builder](04-contracts-builder.md) | Documento, manifiesto, comandos, adaptador |
| 05 | [Protocolo iframe](05-iframe-protocol.md) | Mensajes postMessage tipados + seguridad |
| 06 | [Registro de bloques](06-block-registry.md) | `defineBlock`, sistema de campos, manifiesto, renderer |
| 07 | [Estructura del monorepo](07-monorepo-structure.md) | Paquetes, nombres, convenciones |
| 08 | [Roadmap](08-roadmap.md) | Fases 0–7 e incremento vertical inicial |
| 09 | [Backlog](09-backlog.md) | Épicas e issues priorizados |
| 10 | [Criterios de aceptación](10-acceptance-criteria.md) | Criterio de éxito + DoD |
| 11 | [Riesgos y amenazas](11-risks.md) | Riesgos, STRIDE, checklist de seguridad |
| 12 | [AI-native y facilidad de uso](12-ai-native.md) | Dev+IA (CLI/MCP/AGENTS.md), cliente+IA, cliente sin IA |

## ADRs

| ADR | Decisión |
|-----|----------|
| [0001](adr/0001-fastify-vs-hono.md) | Backend: **Fastify** (vs Hono) |
| [0002](adr/0002-astro-rendering-strategy.md) | Astro: **híbrido SSR on-demand** por defecto |
| [0003](adr/0003-modular-monolith.md) | Monolito modular con fronteras verificadas |
| [0004](adr/0004-document-json-model.md) | Contenido visual como árbol JSON versionado |
| [0005](adr/0005-single-site-not-multitenant.md) | Single-site, multisite-ready |
| [0006](adr/0006-postgres-primary-sqlite-tests.md) | Postgres primario; SQLite sólo tests puros |
| [0007](adr/0007-testing-strategy.md) | Estrategia de pruebas |
| [0008](adr/0008-infrastructure-agnostic.md) | **Infra-agnóstico** por puertos y adaptadores |
| [0009](adr/0009-ai-native-safe-operations.md) | **Operabilidad por IA** segura por construcción |

## Incrementos implementados (bitácora)

| Doc | Contenido | Estado |
|-----|-----------|--------|
| [INCREMENT-1](INCREMENT-1.md) | Slice CMS: auth, páginas, drafts, revisiones, API, panel React, Astro SSR | ✅ verificado |
| [INCREMENT-2](INCREMENT-2.md) | Base builder: schemas, builder-core (engine/undo-redo/validación/migraciones), adapters | ✅ verificado |
| [INCREMENT-3-4](INCREMENT-3-4.md) | Builder↔CMS (persistencia+API+SDK+cmsAdapter) y renderer Astro | ✅ verificado |
| [INCREMENT-media](INCREMENT-media.md) | Biblioteca de medios (storage+Sharp+multipart) — asistido por Codex | ✅ verificado |
| [INCREMENT-5 (spec)](INCREMENT-5-builder-react-spec.md) | Builder visual `builder-react` — implementado (Codex) y verificado en navegador | ✅ verificado |
| [INCREMENT-6 (spec)](INCREMENT-6-cli-mcp-spec.md) | CLI `astrocms` + servidor MCP (AI-native) | 🔄 en curso |
| Menús + Ajustes + SEO + Webhooks | Backend + admin + HMAC — asistido por Codex | ✅ verificado |

**Estado actual:** ~51 tests verdes, 13+ proyectos con typecheck estricto. CMS + builder visual +
medios + menús/ajustes/webhooks funcionando end-to-end. Pendiente: CLI/MCP (en curso), e2e Playwright.

**Método reciente:** delegación de incrementos a **Codex** (gpt-5.5, modo escritura) + verificación y
endurecimiento por Claude (typecheck/tests contra Postgres + prueba en navegador). Ver notas de
correcciones en cada doc de incremento.

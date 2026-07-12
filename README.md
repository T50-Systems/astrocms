# AstroCMS

> **Work in progress.** Proyecto en desarrollo activo: la API, el esquema de datos y el panel
> pueden cambiar sin previo aviso. Aún no hay una versión estable ni release publicado.

Plataforma de dos productos integrables para proyectos Astro:

- **CMS para Astro** — núcleo autohospedable (como el core de WordPress): contenido, usuarios,
  permisos, medios, páginas, revisiones, publicación, SEO, menús, API. Funciona **sin** el builder.
- **Builder visual** — editor WYSIWYG de bloques Astro (como Elementor): edita la estructura
  visual del documento (JSON), se integra con el CMS por **SDK y adaptadores** (nunca toca sus tablas).

El **proyecto Astro** es el tema/frontend público; los **componentes Astro registrados** son los
bloques/widgets. El CMS es la fuente de verdad; Astro renderiza.

## Estado del proyecto

- **Fase 0 — Definición: completa.** Ver [`docs/`](docs/README.md).
- **Incremento vertical 1: completo y verificado.** Auth, páginas con revisiones, drafts,
  publicación, API v1, panel React, render público en Astro (SSR). 20 tests verdes contra
  Postgres real + verificación en navegador. Comandos y detalle en
  [docs/INCREMENT-1.md](docs/INCREMENT-1.md).

### Puesta en marcha rápida

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres
export DATABASE_URL="postgres://astrocms:astrocms@127.0.0.1:5433/astrocms"
pnpm --filter @astrocms/cms-database db:migrate && pnpm --filter @astrocms/cms-database db:seed
pnpm --filter @astrocms/cms-server start   # API :3000
pnpm --filter @astrocms/cms-admin  dev     # panel :5173
```
Login demo: `admin@astrocms.local` / `Admin!2345`. Detalle en [docs/INCREMENT-1.md](docs/INCREMENT-1.md).

## Stack

TypeScript estricto de extremo a extremo. Monorepo pnpm + Turborepo. Frontend público **Astro**
(SSR híbrido). Panel **React** (TanStack Router/Query, React Hook Form, Zod). Backend **Fastify**.
ORM **Drizzle** sobre **PostgreSQL**. Rich text **Tiptap**. Drag-and-drop **dnd-kit**. Imágenes
**Sharp**. Storage abstracto (fs/S3/R2/MinIO). Tests **Vitest** + **Playwright**. **Docker Compose**
para el entorno local. Decisiones justificadas en los [ADRs](docs/README.md#adrs).

## Estructura (objetivo)

Ver [docs/07-monorepo-structure.md](docs/07-monorepo-structure.md). Los paquetes se crean al
implementarse — sin carpetas vacías.

## Requisitos de entorno

Node ≥ 20, pnpm ≥ 9, Docker. Copia `.env.example` a `.env` antes de arrancar.

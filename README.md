# AstroCMS

> **Work in progress.** Project under active development: the API, data schema, and admin panel
> may change without notice. There is no stable version or published release yet.

Two-product integrable platform for Astro projects:

- **CMS for Astro** — self-hostable core (like WordPress core): content, users,
  permissions, media, pages, revisions, publishing, SEO, menus, API. Works **without** the builder.
- **Visual builder** — WYSIWYG editor for Astro blocks (like Elementor): edits the
  visual structure of the document (JSON), integrates with the CMS via **SDK and adapters** (never touches its tables).

The **Astro project** is the public theme/frontend; the **registered Astro components** are the
blocks/widgets. The CMS is the source of truth; Astro renders.

## Project status

- **Phase 0 — Definition: complete.** See [`docs/`](docs/README.md).
- **Vertical increment 1: complete and verified.** Auth, pages with revisions, drafts,
  publishing, API v1, React admin panel, public rendering in Astro (SSR). 20 passing tests against
  real Postgres + browser verification. Commands and details in
  [docs/INCREMENT-1.md](docs/INCREMENT-1.md).

### Quick start

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres
export DATABASE_URL="postgres://astrocms:astrocms@127.0.0.1:5433/astrocms"
pnpm --filter @astrocms/cms-database db:migrate && pnpm --filter @astrocms/cms-database db:seed
pnpm --filter @astrocms/cms-server start   # API :3000
pnpm --filter @astrocms/cms-admin  dev     # admin panel :5173
```
Demo login: `admin@astrocms.local` / `Admin!2345`. Details in [docs/INCREMENT-1.md](docs/INCREMENT-1.md).

## Stack

Strict end-to-end TypeScript. pnpm + Turborepo monorepo. Public frontend **Astro**
(hybrid SSR). **React** admin panel (TanStack Router/Query, React Hook Form, Zod). **Fastify** backend.
**Drizzle** ORM on top of **PostgreSQL**. Rich text with **Tiptap**. Drag-and-drop with **dnd-kit**. Images via
**Sharp**. Abstract storage (fs/S3/R2/MinIO). Tests with **Vitest** + **Playwright**. **Docker Compose**
for the local environment. Decisions justified in the [ADRs](docs/README.md#adrs).

## Structure (target)

See [docs/07-monorepo-structure.md](docs/07-monorepo-structure.md). Packages are created as they
are implemented — no empty folders.

## Environment requirements

Node ≥ 20, pnpm ≥ 9, Docker. Copy `.env.example` to `.env` before starting.

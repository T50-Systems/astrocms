# Incremento vertical 1 — Auth + Páginas + Drafts + API + Panel + Astro

Primer corte funcional y **verificado end-to-end** (Postgres real + navegador). Cubre el
esqueleto de los Hitos 1–3 del [roadmap](08-roadmap.md).

## Qué incluye

| Capa | Paquete/App | Contenido |
|------|-------------|-----------|
| Contratos | `@astrocms/contracts` | Tipos + Zod de auth, entries/páginas, sesión, errores |
| Datos | `@astrocms/cms-database` | Drizzle schema (10 tablas), migración `0000`, seed idempotente |
| Auth | `@astrocms/cms-auth` | argon2id, tokens de sesión (hash), RBAC admin/editor |
| Dominio | `@astrocms/cms-core` | Login/sesión; entries con **versiones**, **tabla de transiciones** (draft↔published↔archived), publish/unpublish/revisiones/restore |
| API | `apps/cms-server` (Fastify) | `/api/v1` auth + pages + public + `/healthz`; cookies HttpOnly; CSRF double-submit; rate-limit en login |
| SDK | `@astrocms/cms-sdk` | Cliente tipado (browser + SSR) |
| Público | `apps/astro-demo` (Astro SSR) | Render de página publicada por slug; 404 si no existe |
| Panel | `apps/cms-admin` (React) | Login, lista, crear/editar página, publicar, revisiones (TanStack Router/Query + RHF + Zod) |

## Verificación realizada

- **Unit + integración:** 20 tests verdes (dominio puro + integración HTTP contra Postgres real).
  El test de integración cubre: login OK/fallido, CSRF obligatorio, draft **oculto** en API pública,
  publicar → visible, editar → nueva versión, revisiones, restaurar.
- **Astro SSR:** página publicada renderizada desde la API pública; slug inexistente → 404.
- **Panel en navegador:** login → sesión (cookie HttpOnly vía proxy) → lista real → crear página
  (slug autogenerado, draft, v1) → editor con publicar/revisiones; logout revoca sesión.
- **Typecheck estricto** limpio en los 9 proyectos. Ningún archivo supera 500 LOC.

## Puesta en marcha (local)

```bash
# 1. Requisitos: Node ≥20, pnpm ≥9, Docker.
cp .env.example .env            # ajusta SESSION_SECRET
pnpm install

# 2. Infra (Postgres en el puerto host 5433; evita chocar con un PG nativo en 5432)
docker compose up -d postgres

# 3. Migración + seed (usuarios demo)
export DATABASE_URL="postgres://astrocms:astrocms@127.0.0.1:5433/astrocms"
pnpm --filter @astrocms/cms-database db:migrate
pnpm --filter @astrocms/cms-database db:seed
#   admin@astrocms.local / Admin!2345   ·   editor@astrocms.local / Editor!2345

# 4. Arrancar (3 terminales, o en background)
pnpm --filter @astrocms/cms-server start     # API en :3000
pnpm --filter @astrocms/cms-admin  dev       # panel en :5173 (proxy /api → :3000)
CMS_API_URL=http://127.0.0.1:3000/api/v1 pnpm --filter @astrocms/astro-demo dev   # sitio en :4321
```

- Panel: http://localhost:5173 → entra con el admin → crea y publica una página.
- Sitio público: http://localhost:4321/<slug> muestra la página publicada (SSR).

## Comandos de verificación

```bash
pnpm -r typecheck
export DATABASE_URL="postgres://astrocms:astrocms@127.0.0.1:5433/astrocms"
export SESSION_SECRET="test-secret-of-32-characters-min!!"
pnpm -r test
```

## Notas de diseño aplicadas (Architecture Advisor)

- **Comportamiento:** ciclo de vida del entry como **status enum + transition table**
  (`entry-transitions.ts`); sin workflow engine (no hay timers/tareas humanas todavía).
- **Decisión:** guardas de autorización (RBAC) en el borde HTTP; el permiso `pages.publish`
  separa publicar de editar.
- **Ejecución:** *command handlers* en `cms-core` con **transacciones** por cambio de estado
  (crear versión + mover puntero) — sin outbox aún (no hay efectos externos; los webhooks llegan después).
- **Hexagonal / infra-agnóstico:** el dominio no conoce HTTP ni el proveedor de DB; `DATABASE_URL`
  apunta a cualquier Postgres. `pingDb` evita filtrar drizzle al borde.

## Pendiente (siguientes incrementos)

Medios (Sharp + storage), menús/SEO/ajustes en el panel, webhooks, ruta de preview con token,
builder (core → react → astro), OpenAPI, e2e Playwright, y el resto de [backlog](09-backlog.md).

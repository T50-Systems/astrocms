# 07 — Estructura definitiva del monorepo

pnpm workspaces + Turborepo. Se conserva la separación CMS / builder / contratos / adaptadores.
Los paquetes se crean **cuando se implementan** (nada de carpetas vacías); esta es la estructura
objetivo y el orden de aparición.

```
astrocms/
├── apps/
│   ├── cms-server/          # Fastify: API v1, sirve admin/builder estáticos, webhooks
│   ├── cms-admin/           # SPA React: TanStack Router + Query + RHF + Zod
│   ├── builder-app/         # SPA React que monta builder-react (ruta /admin/builder)
│   ├── astro-demo/          # sitio Astro de ejemplo + ruta de preview + registro de bloques
│   └── docs/                # documentación navegable (Astro Starlight)  [opcional MVP]
│
├── packages/
│   ├── contracts/           # tipos + Zod: API, documento, manifiesto, mensajes iframe
│   ├── schemas/             # sistema de campos (descriptor → Zod/TS/form/defaults)
│   ├── storage/             # StorageDriver + drivers fs/s3/r2/minio
│   ├── ui/                  # design system React del panel (accesible)
│   ├── testing/             # fixtures, factories, helpers de DB de test
│   │
│   ├── cms-core/            # casos de uso del CMS (sin HTTP)
│   ├── cms-database/        # Drizzle schema + migraciones + repos
│   ├── cms-auth/            # sesiones, hashing, CSRF, RBAC
│   ├── cms-sdk/             # cliente TS de la API v1
│   ├── cms-astro/           # integración Astro (SSR helpers, preview, manifiesto loader)
│   │
│   ├── builder-core/        # documento, comandos, undo/redo, validación, migraciones
│   ├── builder-react/       # canvas, árbol, inspector, dnd (sobre builder-core)
│   ├── builder-astro/       # runtime de render de bloques + defineBuilderConfig + manifiesto
│   ├── builder-sdk/         # createBuilderClient + BuilderStorageAdapter
│   ├── builder-default-blocks/  # 10 bloques base (def + componentes Astro de referencia)
│   ├── builder-adapters/    # cmsBuilderAdapter, inMemoryAdapter, jsonFileAdapter
│   │
│   ├── cli/                 # `astrocms` CLI: generate/add/migrate/validate/manifest (salida JSON)
│   └── mcp/                 # servidor MCP: expone el CMS/proyecto como herramientas de IA
│
├── docs/                    # ESTE conjunto de documentos de diseño (Fase 0)
├── migrations/              # SQL generado por drizzle-kit (fuente reproducible)
├── docker/                  # Dockerfiles (cms-server, astro-demo)
├── docker-compose.yml       # postgres, minio, cms-server, astro-demo
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json
├── .npmrc
├── .gitignore
└── .env.example
```

## Cambios respecto a la propuesta original (justificados)

- **`builder-adapters` como paquete propio** (en vez de dentro de `builder-sdk`): los adaptadores
  `cmsBuilderAdapter` dependen de `cms-sdk`; mantenerlos separados evita que `builder-sdk` (núcleo
  agnóstico) arrastre una dependencia del CMS. Refuerza la portabilidad.
- **`cms-astro` unifica** "SDK Astro + integración SSR + preview": es la cara de Astro hacia el CMS.
- **`apps/docs` opcional en el MVP**: no bloquea el criterio de éxito; puede añadirse en Fase 7.
- **`registry.generated.ts`** (mapa `type → componente`) se genera en build de `astro-demo`; no es
  un paquete, es un artefacto local del proyecto Astro.

## Nombres de paquetes (npm scope)

`@astrocms/contracts`, `@astrocms/schemas`, `@astrocms/storage`, `@astrocms/ui`,
`@astrocms/testing`, `@astrocms/cms-core`, `@astrocms/cms-database`, `@astrocms/cms-auth`,
`@astrocms/cms-sdk`, `@astrocms/cms-astro`, `@astrocms/builder-core`, `@astrocms/builder-react`,
`@astrocms/builder-astro`, `@astrocms/builder-sdk`, `@astrocms/builder-default-blocks`,
`@astrocms/builder-adapters`, `@astrocms/cli`, `@astrocms/mcp`.

Los adaptadores de infraestructura (storage/cache/queue/mailer/ai) viven junto a su puerto:
`storage` ya incluye los suyos; `cache`/`jobs`/`mail`/`ai` son subpaquetes de `cms-core` con el
puerto + adaptador por defecto (0 infra), y los adaptadores opcionales (redis, bullmq, smtp…) se
añaden cuando un despliegue los pida (ver [ADR-0008](adr/0008-infrastructure-agnostic.md)).

## Convenciones

- **TS estricto** en `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`). Sin `any` salvo justificación documentada en el sitio de uso.
- **ESLint + Prettier** en la raíz; regla de **fronteras** (`dependency-cruiser`) que prohíbe a
  `builder-*` importar de `cms-core`/`cms-database`/`cms-auth`.
- **Turbo pipelines:** `build`, `dev`, `lint`, `typecheck`, `test`, `test:e2e`, `db:migrate`, `db:seed`.
- **Cada paquete** expone `exports` tipados y su propio `tsconfig` que extiende el base.
- **Sin secretos en el repo**: `.env.example` documenta variables; los valores van en `.env` ignorado.

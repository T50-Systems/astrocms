# 01 — Arquitectura, módulos y despliegue

## 1. Estilo arquitectónico

**Monolito modular** (no microservicios en el MVP). Un servidor Node (Fastify — ver
[ADR-0001](adr/0001-fastify-vs-hono.md)) expone la API; el panel es una SPA React; el sitio
público es una app Astro. La modularidad vive en **paquetes** con fronteras explícitas y
dependencias unidireccionales, no en despliegues separados.

Regla de dependencias (las flechas indican "puede importar de"):

```
apps/*  ──►  packages/*        (las apps dependen de paquetes, nunca al revés)
cms-*   ──►  contracts, schemas, storage, ui, testing
builder-* ──► contracts, schemas, ui, testing        (NUNCA importa cms-database ni cms-core)
builder-* ──► cms-sdk          (única vía del builder hacia el CMS: contrato público)
astro-*  ──► contracts, schemas, cms-sdk, builder-astro
contracts, schemas ──► (nada; hojas sin dependencias de dominio)
```

**Invariante de acoplamiento:** `builder-*` no puede importar de `cms-core`, `cms-database`
ni `cms-auth`. Se verifica con un lint de fronteras (`eslint-plugin-boundaries` /
`dependency-cruiser`) en CI. Cualquier necesidad del builder respecto al CMS pasa por
`contracts` (tipos) o `cms-sdk` (runtime).

## 1.1 Puertos de infraestructura (hexagonal — [ADR-0008](adr/0008-infrastructure-agnostic.md))

El dominio (`cms-core`, `builder-core`) sólo conoce **interfaces**; los proveedores concretos se
resuelven en el **composition root** de `cms-server` y se **inyectan**. Con los adaptadores por
defecto (columna "0 infra") la plataforma arranca sin nada más que Postgres.

```
                       cms-server (composition root)
   env vars ──► resuelve adaptadores ──► inyecta puertos ──► cms-core / builder-core
                                                                 (no importan SDKs de proveedores)

  StorageDriver  → fs | s3 | r2 | minio | gcs         (default: fs)
  CacheDriver    → memory | redis                     (default: memory)
  JobQueue       → in-process | pgboss | bullmq       (default: in-process)
  Mailer         → noop/log | smtp                    (default: noop)
  SecretsProvider→ env | vault | ssm                  (default: env)
  Logger         → stdout(json) | apm                 (default: stdout)
  AiProvider     → none | <plugin>                    (default: none, opcional)
  Clock/Id       → estándar (inyectable en tests)
```

**Invariante infra:** el dominio y los adaptadores están separados; `cms-core`/`builder-core` **no**
importan `@aws-sdk/*`, `ioredis`, ni SDKs de proveedor — sólo los adaptadores lo hacen. Se verifica
en CI junto con la regla de fronteras. Único backing service obligatorio: **SQL compatible con Postgres**.

## 2. Mapa de módulos

```
┌──────────────────────────────────────────────────────────────────────┐
│                              apps                                       │
│  cms-server      cms-admin      builder-app     astro-demo     docs     │
│  (Fastify API)   (React SPA)    (React, monta   (sitio+preview)         │
│                                  builder-react)                         │
└───────┬───────────────┬──────────────┬───────────────┬────────────────┘
        │               │              │               │
┌───────▼───────────────▼──────────────▼───────────────▼────────────────┐
│                            packages                                     │
│                                                                         │
│  CMS                    BUILDER                 INTEGRACIÓN / COMPARTIDO │
│  ├ cms-core             ├ builder-core          ├ contracts (tipos+Zod) │
│  ├ cms-database         ├ builder-react         ├ schemas (campos)      │
│  ├ cms-auth             ├ builder-astro         ├ storage (files)       │
│  ├ cms-sdk (cliente)    ├ builder-sdk           ├ ui (design system)    │
│  ├ cms-astro (SDK+SSR)  ├ builder-default-blocks├ testing (utils)      │
│                         └ builder adapters                              │
└─────────────────────────────────────────────────────────────────────── ┘
```

### Responsabilidad por paquete

| Paquete                  | Responsabilidad | Depende de |
|--------------------------|-----------------|------------|
| `contracts`              | Tipos e interfaces públicas + esquemas Zod de la API, documentos, mensajes iframe. **Fuente única de verdad de tipos.** | — |
| `schemas`                | Sistema de campos (`text`, `media`, `repeater`…): tipo → Zod + TS + defaults + metadatos de formulario. | contracts |
| `storage`               | Interfaz `StorageDriver` + drivers fs / S3 / R2 / MinIO. | — |
| `ui`                     | Design system React del panel (accesible). | — |
| `testing`                | Fixtures, factories, helpers de DB de test. | contracts, cms-database |
| `cms-core`               | Casos de uso del CMS (páginas, entries, revisiones, publicación, menús, SEO, medios, webhooks). Sin HTTP. | contracts, schemas, cms-database, storage |
| `cms-database`           | Drizzle schema, migraciones, repos. | contracts |
| `cms-auth`               | Sesiones, hashing, CSRF, RBAC. | contracts, cms-database |
| `cms-sdk`                | Cliente TS tipado de la API v1 (browser + Node). | contracts |
| `cms-astro`              | Integración Astro: helpers SSR, `getPage`, loader del manifiesto, ruta de preview. | contracts, cms-sdk |
| `builder-core`           | Modelo de documento, comandos, undo/redo, validación, migraciones, selección. **Framework-agnóstico.** | contracts, schemas |
| `builder-react`          | UI del builder (canvas, árbol, inspector, dnd) sobre `builder-core`. | builder-core, ui, contracts |
| `builder-astro`          | Runtime de render de bloques en Astro + inyección de `data-builder-*`. | contracts, schemas |
| `builder-sdk`            | `createBuilderClient({ adapter })`, interfaz `BuilderStorageAdapter`. | contracts |
| `builder-default-blocks` | Los 10 bloques base (definición + componentes Astro de referencia). | schemas, builder-astro |
| adapters                 | `cmsBuilderAdapter`, `inMemoryAdapter`, `jsonFileAdapter`. | builder-sdk, cms-sdk |

## 3. Diagrama de despliegue (MVP, single-site)

```
                         ┌─────────────────────────────┐
   Cliente (editor) ────►│  cms-admin (SPA estática)    │
                         │  servida por cms-server       │
                         └──────────────┬──────────────┘
                                        │  fetch  /api/v1/* (cookie sesión)
                                        ▼
   ┌───────────────────────────────────────────────────────────────┐
   │                     cms-server  (Node / Fastify)               │
   │  /api/v1/admin/*   API administrativa (sesión + RBAC)          │
   │  /api/v1/public/*  API pública (sólo publicado)                │
   │  /api/v1/preview/* API preview (token/sesión)                  │
   │  /api/v1/builder/* documentos + manifiesto                     │
   │  /api/v1/webhooks  disparo de webhooks                         │
   └───────┬───────────────────────┬───────────────────────────────┘
           │ Drizzle               │ StorageDriver
           ▼                       ▼
   ┌──────────────┐        ┌──────────────────────┐
   │ PostgreSQL   │        │ Object storage        │
   │ (fuente de   │        │ fs / S3 / R2 / MinIO  │
   │  verdad)     │        │ (originales+variantes)│
   └──────────────┘        └──────────────────────┘

           ▲ HTTP (cms-sdk / webhooks de rebuild o revalidación)
           │
   ┌───────┴───────────────────────────────────────────────────────┐
   │                 astro-demo  (Node SSR, ver ADR-0002)           │
   │  /*                       páginas públicas (sólo publicado)     │
   │  /__builder/preview/:id   render del draft (auth por token)     │
   │  data-builder-node-id / data-builder-type en cada bloque        │
   └────────────────────────────────────────────────────────────────┘
                                        ▲
                                        │ iframe + postMessage
   ┌────────────────────────────────────┴──────────────────────────┐
   │  builder-app (dentro de /admin/builder/...)                    │
   │  Canvas = iframe → /__builder/preview/:id                      │
   └────────────────────────────────────────────────────────────────┘
```

Contenedores en `docker-compose.yml`: `postgres`, `minio` (dev de S3), `cms-server`,
`astro-demo`. `cms-admin` y `builder-app` se compilan a estáticos servidos por `cms-server`
(o por Astro/CDN) — no requieren contenedor propio en el MVP.

## 4. Flujos clave

### 4.1 Publicar una página con builder
1. Editor abre `/admin/builder/pages/:pageId` → `builder-app` monta `builder-react`.
2. `builder-sdk` (con `cmsBuilderAdapter`) hace `GET /api/v1/builder/documents/:docId` (draft).
3. Canvas carga iframe `/__builder/preview/:docId?token=…`. Astro renderiza el draft.
4. Edición → comandos en `builder-core` mutan el documento en memoria (undo/redo local).
5. Al hover/select/cambio, `builder-react` ⇄ iframe por `postMessage` (protocolo tipado).
6. "Guardar" → `PUT /api/v1/builder/documents/:docId` (persiste draft + crea `builder_document_version`).
7. "Publicar" → `POST /api/v1/pages/:pageId/publish`: valida documento, congela versión publicada,
   dispara webhooks (revalidación/rebuild), auditoría.
8. URL pública sirve la versión publicada renderizada por Astro.

### 4.2 Página sin builder (rich text)
Igual pero `editorType: "rich-text"`; el contenido vive en un campo `richText` del entry,
sin `builder_document`. Confirma que el CMS no depende del builder.

## 5. Diagrama de módulos (dependencias, resumen)

```
contracts ◄── schemas ◄── cms-core ◄── cms-server
    ▲            ▲            ▲
    │            │            └── cms-auth, cms-database, storage
    │            │
    │            └── builder-core ◄── builder-react ◄── builder-app
    │                     ▲                                  │
    │                     └── builder-astro ◄── astro-demo   │
    │                                                        │
    └── cms-sdk ◄── builder-sdk/adapters ◄──────────────────┘
```
Ninguna flecha entra a `cms-database`/`cms-core`/`cms-auth` desde `builder-*`. ✔ invariante de fronteras.

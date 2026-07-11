# Incremento — Biblioteca de medios (asistido por Codex)

Implementado por Codex (gpt-5.5) y **verificado/endurecido** por Claude. Cubre el bloque de medios
del Hito 2. Verificado contra Postgres real.

## Qué incluye

| Capa | Contenido |
|------|-----------|
| `@astrocms/storage` (NUEVO) | `StorageDriver` (put/get/delete/exists/url) + driver **filesystem** con claves opacas (sin path traversal). Infra-agnóstico (ADR-0008). 8 tests. |
| `contracts` | `MediaAsset`, `MediaVariant`, `MediaQuery` + Zod (`media.ts`) |
| `cms-database` | Tablas `media_assets` + `media_variants` (migración `0002_media_library.sql`) |
| `cms-core` | `media-service`: validación de **MIME real por magic bytes**, límite de tamaño, **checksum SHA-256**, variantes **Sharp** (`thumb` 200w, `md` 800w, `webp`), persistencia y borrado. Inyecta `StorageDriver` (puerto). |
| `cms-server` | `POST/GET /media`, `GET /media/:id`, `DELETE /media/:id`, y `GET /media/file/:key` **público**. Uploads con **@fastify/multipart** (streaming, límite de tamaño). RBAC `media.read/write/delete`. |
| `cms-sdk` | `cms.media.list/get/upload(File\|Blob)/remove` |

## Verificación

- **45 tests verdes** en el workspace (storage 8; cms-server 10, incluidos 2 de media: upload con
  variantes+checksum, y **rechazo de MIME falso**). Typecheck estricto en 12 proyectos.
- Migración `0002` aplicada a Postgres; tablas + índices confirmados.

## Correcciones de Claude sobre el entregable de Codex

- El sandbox de Codex **no tenía red**: dejó `node_modules` a medias y no pudo verificar. Reparado con
  `pnpm install` (sharp compilado con prebuilds).
- Añadido `drizzle-orm` a **devDependencies** de `cms-server` (el test de media consulta la DB) — el
  borde de producción sigue sin importar drizzle.
- **Sustituido el parser multipart casero** de Codex por **@fastify/multipart** (robustez + límite de
  tamaño real en streaming); eliminado `apps/cms-server/src/multipart.ts`.
- Servido de ficheros hecho **público** (clave opaca) para que las imágenes de páginas publicadas
  carguen sin sesión. Media privada / URLs firmadas → endurecimiento (Fase 7).

## Método (lean-on-Codex)

Codex implementó el grueso con gpt-5.5 en modo escritura (yolo); Claude reparó entorno, corrigió el
typecheck, endureció seguridad (multipart, acceso público) y **verificó de verdad** (typecheck + tests
contra Postgres) antes de dar por bueno el incremento. Patrón: *Codex escribe → Claude verifica y endurece*.

# 09 — Backlog inicial (formato issues)

Prioridad: **P0** = bloqueante del criterio de éxito · **P1** = MVP · **P2** = endurecimiento.
Formato: `#ID [Área][Prio] Título — criterio de aceptación resumido`.

## Épica A — Fundaciones del monorepo
- `#A1 [Infra][P0]` Monorepo pnpm + Turbo + tsconfig estricto + ESLint/Prettier — `pnpm i && pnpm typecheck` verde.
- `#A2 [Infra][P0]` Regla de fronteras (dependency-cruiser): `builder-*` no importa `cms-core/database/auth` — falla CI si se viola.
- `#A3 [Infra][P0]` Docker Compose: postgres + minio arriba con `docker compose up` — health checks OK.
- `#A4 [Infra][P1]` `.env.example`, seeds, health check `/healthz` — documentado en README.

## Épica B — Contratos y esquemas
- `#B1 [Contracts][P0]` `@astrocms/contracts`: tipos + Zod de API, documento, manifiesto, mensajes iframe — `pnpm typecheck` y tests de round-trip Zod.
- `#B2 [Schemas][P0]` Descriptores de campos base (text, richText, media, select, number, boolean) — cada uno genera Zod+default+serialize; tests.
- `#B3 [Schemas][P1]` Resto de campos (repeater, object, blocks, relation, taxonomy, gallery, tokens…) — tests por campo.

## Épica C — Base de datos y auth (Hito 1)
- `#C1 [DB][P0]` Drizzle schema + migración inicial de todas las tablas de [02-data-model] — `db:migrate` reproducible.
- `#C2 [DB][P0]` Seed dev (site, admin, editor, roles/permisos, content types page/post) — idempotente.
- `#C3 [Auth][P0]` Hashing (argon2/bcrypt), login, sesión en cookie HTTP-only, logout, `/me` — tests de integración.
- `#C4 [Auth][P0]` CSRF (double-submit) + rate limit en `/auth/login` — tests de rechazo.
- `#C5 [Auth][P1]` RBAC: middleware de permisos, sesiones revocables — editor no accede a `users.manage`.

## Épica D — Contenido (Hito 1)
- `#D1 [Content][P0]` CRUD de entries + slug único + estados — tests.
- `#D2 [Content][P0]` Versionado: cada save crea `entry_version`; `current`/`published` — tests.
- `#D3 [Content][P0]` Publicar/despublicar + auditoría — publicado ≠ sobrescribe draft.
- `#D4 [Content][P1]` Revisiones: listar, comparar (diff), restaurar — restore crea nueva versión.
- `#D5 [Content][P1]` SEO por entry (SeoMeta) + validación — API lo persiste/devuelve.
- `#D6 [Content][P1]` Webhooks: registrar + disparar en publish con HMAC — `webhook_deliveries` registra intento.

## Épica E — API (Hito 1/3)
- `#E1 [API][P0]` Rutas admin v1 (pages, media, menus, settings) con validación Zod — 400 en payload inválido.
- `#E2 [API][P0]` API pública (`/public/*`) sólo publicado, sin auth — draft no visible.
- `#E3 [API][P0]` API preview (`/preview/*`) con token firmado — 401 sin token.
- `#E4 [API][P1]` OpenAPI generado desde Zod (`@fastify/swagger`) — `/docs` sirve el spec.

## Épica F — Medios (Hito 2)
- `#F1 [Media][P0]` `StorageDriver` fs + s3/minio — subir/leer/borrar; tests con minio.
- `#F2 [Media][P0]` Upload con validación MIME real + límites + checksum + Sharp variantes — rechaza MIME falso.
- `#F3 [Media][P1]` URLs firmadas cuando el driver lo requiera — expiran.

## Épica G — Panel admin (Hito 2)
- `#G1 [Admin][P0]` Shell: login, router (TanStack), query, layout, guard de auth — redirige sin sesión.
- `#G2 [Admin][P0]` Lista + form de páginas (RHF+Zod) con estados loading/error/empty — a11y básica.
- `#G3 [Admin][P1]` Biblioteca de medios + picker reutilizable — usado por form y builder.
- `#G4 [Admin][P1]` Menús, SEO, ajustes, usuarios (admin) — editor no ve usuarios.

## Épica H — Integración Astro (Hito 3)
- `#H1 [Astro][P0]` `cms-astro`: `getPage`/`getEntry` SSR + config SSR (ADR-0002) — página publicada renderiza.
- `#H2 [Astro][P0]` Renderer recursivo de documentos + `registry.generated` — árbol → HTML.
- `#H3 [Astro][P0]` Ruta `/__builder/preview/:id` con token + `data-builder-*` — draft visible con token.
- `#H4 [Astro][P1]` Tema demo (`defineTheme`) + páginas públicas + 404 — demo navegable.

## Épica I — Builder core (Hito 4)
- `#I1 [Builder][P0]` Modelo de documento + validación contra manifiesto — tests.
- `#I2 [Builder][P0]` Comandos + undo/redo determinista — property tests.
- `#I3 [Builder][P0]` Migraciones de bloques (`version` por nodo) — documento viejo migra al cargar.
- `#I4 [Builder][P0]` `BuilderStorageAdapter` + inMemory/jsonFile/cms — intercambiables en tests.

## Épica J — Builder visual (Hito 5)
- `#J1 [Builder][P0]` Canvas iframe + protocolo postMessage tipado + validación origen — handshake OK.
- `#J2 [Builder][P0]` Panel de bloques + árbol de nodos + selección sincronizada — click canvas ↔ árbol.
- `#J3 [Builder][P0]` Inspector (formularios desde manifiesto) + `setProp` — cambia prop en vivo.
- `#J4 [Builder][P0]` dnd-kit: insertar/reordenar/mover con constraints — respeta padres/hijos permitidos.
- `#J5 [Builder][P0]` Edición inline → `guest/inline-edit` → `setProp` (no guarda HTML) — documento es la verdad.
- `#J6 [Builder][P1]` Duplicar/ocultar/eliminar + responsive por breakpoint + patrones/plantillas — capabilities respetadas.

## Épica K — Integración completa (Hito 6)
- `#K1 [E2E][P0]` Builder como editor del CMS: load/save draft/publish vía adaptador — persiste.
- `#K2 [E2E][P0]` Permisos + preview + errores (schema-mismatch, preview-error) — banner y no rompe.
- `#K3 [E2E][P0]` Playwright: los 18 pasos del criterio de éxito — verde en CI.

## Épica M — Infra-agnóstico (ADR-0008, transversal)
- `#M1 [Infra][P0]` Puertos `CacheDriver`/`JobQueue`/`Mailer`/`SecretsProvider`/`Logger` con adaptador por defecto (0 infra) + composition root que inyecta desde env — arranca sólo con Postgres.
- `#M2 [Infra][P0]` `StorageDriver` fs + s3/minio detrás del puerto; dominio no importa SDKs de proveedor — regla de fronteras en CI.
- `#M3 [Infra][P1]` Imagen OCI + `docker-compose` reproducible; sin APIs propietarias — corre en VPS/PaaS/k8s con sólo env.
- `#M4 [Infra][P2]` Adaptadores opcionales (redis, pgboss, smtp) + docs de despliegue por proveedor.

## Épica N — AI-native y facilidad (ADR-0009)
- `#N1 [DX][P1]` CLI `astrocms` (`generate block`, `add content-type`, `generate types`, `validate`, `manifest --json`) idempotente, salida JSON, errores accionables.
- `#N2 [DX][P1]` `AGENTS.md` generado por el instalador con convenciones/comandos/límites.
- `#N3 [DX][P1]` OpenAPI + JSON Schemas + `BlockManifest` expuestos (`/openapi.json`, `/builder/manifest`) — sistema auto-descriptivo.
- `#N4 [AI][P2]` Servidor MCP `@astrocms/mcp` con herramientas tipadas (introspección + operaciones validadas + RBAC).
- `#N5 [AI][P2]` Puerto `AiProvider` + `aiAssistantPlugin()` opcional: NL→`BuilderCommand[]` con preview/confirmación; helpers de texto/SEO/alt. Agnóstico de proveedor; desactivable.
- `#N6 [AI][P2]` Tests de contrato: operaciones de IA inválidas se rechazan igual que las de un humano.
- `#N7 [UX][P1]` Plantillas de página + patrones + empty states guiados + copy sin jerga (facilidad sin depender de IA).

## Épica L — Endurecimiento (Hito 7)
- `#L1 [Sec][P2]` Auditoría completa, revocación de sesiones, sanitización rich text, path traversal — pruebas de seguridad.
- `#L2 [Perf][P2]` Cache de manifiesto/público + parches incrementales del preview — medido.
- `#L3 [Docs][P2]` Instalador + guía "nuevo proyecto Astro" + segundo demo (criterio #19).

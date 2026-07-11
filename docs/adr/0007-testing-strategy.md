# ADR-0007 — Estrategia de pruebas

- **Estado:** Aceptado
- **Fecha:** 2026-07-10

## Pirámide

1. **Unitarias (Vitest)** — dominio puro: sistema de campos (Zod/defaults), `builder-core`
   (comandos, undo/redo con **property-based tests**, migraciones), validación de documentos,
   utilidades de storage. Rápidas, sin IO.
2. **Integración (Vitest + Postgres real)** — repos Drizzle, casos de uso de `cms-core`, auth
   (sesiones/CSRF/rate limit), API (Fastify `inject`), uploads con MinIO, webhooks (HMAC).
   DB efímera vía Docker Compose/testcontainers; migraciones aplicadas antes de cada suite.
3. **End-to-end (Playwright)** — el flujo del criterio de éxito (18 pasos), incluyendo el canal
   `postMessage` del builder y el preview en iframe. Corre contra el stack de compose.

## Contratos y no-duplicación

- Round-trip de esquemas: cada tipo de `contracts` se valida con su Zod; test que asegura que
  el `manifest` serializado **no** contiene `component`.
- Tests de fronteras: `dependency-cruiser` en CI como "test" de arquitectura.

## Datos y entorno

- **Seeds** deterministas para dev y e2e (site, admin, editor, content types, media de ejemplo).
- **Fixtures** de documentos del builder (incluye uno desactualizado para probar migraciones).
- Cada incremento vertical entrega sus tests (DoD en [10-acceptance-criteria]).

## Seguridad como test

- Tests negativos: draft no visible en API pública; preview sin token → 401; MIME falso rechazado;
  origin inválido en postMessage descartado; editor sin `users.manage` → 403; rate limit → 429.

## Cobertura objetivo

- Dominio (`cms-core`, `builder-core`, `schemas`): alta (≥85%).
- Capas HTTP/UI: cobertura por criterios de aceptación, no por porcentaje.

# ADR-0006 — PostgreSQL primario; SQLite sólo para tests unitarios puros

- **Estado:** Aceptado
- **Fecha:** 2026-07-10
- **Decisión:** PostgreSQL es la base en dev, test de integración y producción. SQLite se permite
  **únicamente** para tests unitarios que no dependan de features específicas de Postgres.

## Contexto

El enunciado prefiere Postgres y permite SQLite en dev "sólo si no introduce divergencias graves".
El modelo usa **JSONB**, `gen_random_uuid()`, índices GIN y `timestamptz`: features donde SQLite
diverge de forma relevante.

## Decisión

- **Dev y test de integración:** Postgres vía `docker-compose` (rápido de levantar).
- **Producción:** Postgres.
- **SQLite:** admisible para pruebas unitarias de lógica que no toque JSONB/índices/tipos Postgres,
  para no pagar el arranque de un contenedor en tests triviales. No es una ruta de despliegue.
- Drizzle se configura contra el dialecto Postgres; no se mantienen dos dialectos de esquema.

## Justificación

Mantener paridad dev/prod evita bugs "funciona en mi máquina". El uso intensivo de JSONB (data,
tree, settings, seo) hace de SQLite una fuente de divergencia real, no cosmética. El pequeño coste
de correr Postgres en dev se absorbe con Docker Compose.

## Consecuencias

- `pnpm db:*` apunta a Postgres; los tests de integración usan una DB efímera (compose/testcontainers).
- No se invierte en compatibilidad SQLite del esquema completo (evita trabajo sin uso real).

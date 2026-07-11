# ADR-0005 — Single-site ahora, multisite-ready en el modelo

- **Estado:** Aceptado
- **Fecha:** 2026-07-10
- **Decisión:** MVP con **una instalación por cliente** (single-site). Se incluye `site_id` en
  las tablas de contenido, pero **no** se implementa multitenancy (sin aislamiento por tenant,
  sin routing por dominio, sin límites por tenant).

## Contexto

El enunciado pide instalación por cliente en la v1 y, a la vez, "no tomar decisiones que hagan
imposible varios sitios en el futuro", sin implementar multitenancy completo todavía.

## Decisión

- Existe la tabla `sites` con **una** fila sembrada; su `id` se resuelve una vez al arrancar.
- Las tablas de contenido llevan `site_id` (FK) desde la migración inicial → evita una migración
  destructiva futura.
- Las queries del MVP filtran por ese único `site_id` mediante un helper central; no hay lógica
  de aislamiento por request-tenant, cuotas ni onboarding de tenants.
- Auth/roles son por-site en el esquema, pero operan sobre el site único.

## Consecuencias

- Coste presente casi nulo (una columna + un filtro), beneficio futuro alto.
- Cuando se aborde multisite, el trabajo será: resolución de tenant por dominio/host, aislamiento
  y cuotas — **no** una remodelación de esquema.
- Se evita la trampa de sobre-ingeniería: no se construye panel/onboarding multi-tenant ahora.

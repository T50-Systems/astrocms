# ADR-0003 — Monolito modular con fronteras verificadas

- **Estado:** Aceptado
- **Fecha:** 2026-07-10
- **Decisión:** Un único despliegue de servidor (monolito) organizado en paquetes con
  dependencias unidireccionales verificadas en CI. Sin microservicios en el MVP.

## Contexto

El enunciado prohíbe microservicios en el MVP y exige "monolito modular con paquetes bien
separados", manteniendo separados CMS, builder, contratos y adaptadores.

## Decisión

- `cms-server` es el único proceso backend; los demás son librerías o apps de frontend.
- La separación de productos vive en **paquetes**, no en servicios.
- **Regla de fronteras** (dependency-cruiser) en CI:
  - `builder-*` **no** puede importar `cms-core`, `cms-database`, `cms-auth`.
  - `cms-core` no importa de `apps/*` ni de Fastify (dominio sin HTTP).
  - `contracts`/`schemas` no dependen de nada de dominio (hojas).
- El builder se comunica con el CMS **sólo** por `cms-sdk` (runtime) y `contracts` (tipos).

## Consecuencias

- Extraer un servicio en el futuro (p.ej. procesado de imágenes) es viable porque el dominio ya
  está aislado de HTTP y las fronteras están explícitas.
- El coste operativo del MVP es mínimo (un backend, un Astro, Postgres, storage).
- Las violaciones de acoplamiento fallan el pipeline, no se detectan en revisión manual.

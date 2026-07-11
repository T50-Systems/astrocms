# ADR-0001 — Backend HTTP: Fastify vs Hono

- **Estado:** Aceptado
- **Fecha:** 2026-07-10
- **Decisión:** Usar **Fastify** para `apps/cms-server` en el MVP.

## Contexto

El CMS es un **monolito modular Node con estado**: PostgreSQL (Drizzle), sesiones con cookies
HTTP-only, subida y procesamiento de imágenes (multipart + Sharp), CSRF, rate limiting, RBAC,
webhooks firmados, OpenAPI. No es una función edge ligera. Node ≥20 en VPS/contenedor (S3).

## Opciones

**Fastify**
- ➕ Ecosistema maduro y mantenido para justo lo que necesito: `@fastify/cookie`,
  `@fastify/session`, `@fastify/csrf-protection`, `@fastify/rate-limit`, `@fastify/multipart`
  (streaming de uploads grandes sin cargarlos en memoria), `@fastify/helmet`, `@fastify/cors`,
  `@fastify/static` (servir el admin), `@fastify/swagger` (OpenAPI).
- ➕ **Type provider de Zod** (`fastify-type-provider-zod`): validación y tipos desde los mismos
  esquemas de `@astrocms/contracts` → sin duplicar esquemas front/back.
- ➕ Hooks de ciclo de vida (`onRequest`, `preHandler`) ideales para auth/RBAC/CSRF por ruta.
- ➕ Rendimiento sobrado para el volumen esperado; logging estructurado nativo (pino).
- ➖ Atado a Node (no edge). Irrelevante: el MVP es autohospedado en Node.

**Hono**
- ➕ Ultraligero, portable (edge/Node/Bun/Workers), excelente inferencia de tipos, RPC.
- ➕ Buena elección si el objetivo fuese desplegar en el edge o multi-runtime.
- ➖ Para uploads con streaming, sesiones con store en DB, CSRF, rate limit y OpenAPI hay que
  ensamblar más middleware a mano o de terceros menos maduros.
- ➖ La portabilidad edge es un valor que **este** producto no necesita (es stateful + Sharp + Postgres).

## Decisión y justificación

Gana **Fastify** porque el CMS es exactamente el caso de uso donde su ecosistema de plugins
(uploads, sesiones, CSRF, rate limit, static, swagger) ahorra código propio y reduce superficie
de error de seguridad, y su integración con Zod cumple el requisito de contratos compartidos.
La principal ventaja de Hono —portabilidad al edge— no aporta valor a un monolito autohospedado
con procesamiento de imágenes y base de datos relacional.

## Consecuencias

- La capa HTTP queda fina: `cms-server` traduce HTTP ⇄ casos de uso de `cms-core` (que no conoce Fastify).
- Si en el futuro se quiere una API edge (p.ej. sólo lectura pública en Workers), se puede exponer
  un subconjunto con Hono **encima de los mismos casos de uso**, sin reescribir el dominio.
- Se adopta `fastify-type-provider-zod` como puente de validación/tipos.

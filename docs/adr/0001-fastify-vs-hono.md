# ADR-0001 — HTTP backend: Fastify vs Hono

- **Status:** Accepted
- **Date:** 2026-07-10
- **Decision:** Use **Fastify** for `apps/cms-server` in the MVP.

## Context

The CMS is a **stateful Node modular monolith**: PostgreSQL (Drizzle), HTTP-only cookie
sessions, image upload and processing (multipart + Sharp), CSRF, rate limiting, RBAC,
signed webhooks, OpenAPI. It is not a lightweight edge function. Node ≥20 on a VPS/container (S3).

## Options

**Fastify**
- ➕ Mature, well-maintained ecosystem for exactly what's needed: `@fastify/cookie`,
  `@fastify/session`, `@fastify/csrf-protection`, `@fastify/rate-limit`, `@fastify/multipart`
  (streaming large uploads without loading them into memory), `@fastify/helmet`, `@fastify/cors`,
  `@fastify/static` (serving the admin), `@fastify/swagger` (OpenAPI).
- ➕ **Zod type provider** (`fastify-type-provider-zod`): validation and types from the same
  `@astrocms/contracts` schemas → no duplicated front/back schemas.
- ➕ Lifecycle hooks (`onRequest`, `preHandler`) ideal for per-route auth/RBAC/CSRF.
- ➕ Plenty of performance for the expected volume; native structured logging (pino).
- ➖ Tied to Node (not edge). Irrelevant: the MVP is self-hosted on Node.

**Hono**
- ➕ Ultra-lightweight, portable (edge/Node/Bun/Workers), excellent type inference, RPC.
- ➕ A good choice if the goal were deploying to the edge or multi-runtime.
- ➖ For streaming uploads, DB-backed sessions, CSRF, rate limiting and OpenAPI, you have to
  assemble more middleware by hand or from less mature third parties.
- ➖ Edge portability is a value **this** product doesn't need (it's stateful + Sharp + Postgres).

## Decision and rationale

**Fastify** wins because the CMS is exactly the use case where its plugin ecosystem
(uploads, sessions, CSRF, rate limit, static, swagger) saves custom code and reduces the
security error surface, and its Zod integration meets the shared-contracts requirement.
Hono's main advantage — edge portability — doesn't add value to a self-hosted monolith
with image processing and a relational database.

## Consequences

- The HTTP layer stays thin: `cms-server` translates HTTP ⇄ `cms-core` use cases (which knows nothing about Fastify).
- If an edge API is wanted in the future (e.g. public read-only on Workers), a subset can be
  exposed with Hono **on top of the same use cases**, without rewriting the domain.
- `fastify-type-provider-zod` is adopted as the validation/type bridge.

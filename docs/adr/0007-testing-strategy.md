# ADR-0007 — Testing strategy

- **Status:** Accepted
- **Date:** 2026-07-10

## Pyramid

1. **Unit (Vitest)** — pure domain: field system (Zod/defaults), `builder-core`
   (commands, undo/redo with **property-based tests**, migrations), document validation,
   storage utilities. Fast, no IO.
2. **Integration (Vitest + real Postgres)** — Drizzle repos, `cms-core` use cases, auth
   (sessions/CSRF/rate limit), API (Fastify `inject`), uploads with MinIO, webhooks (HMAC).
   Ephemeral DB via Docker Compose/testcontainers; migrations applied before each suite.
3. **End-to-end (Playwright)** — the success-criteria flow (18 steps), including the builder's
   `postMessage` channel and the iframe preview. Runs against the compose stack.

## Contracts and non-duplication

- Schema round-trip: each `contracts` type is validated with its Zod schema; a test ensures
  the serialized `manifest` does **not** contain `component`.
- Boundary tests: `dependency-cruiser` in CI as an architecture "test."

## Data and environment

- Deterministic **seeds** for dev and e2e (site, admin, editor, content types, sample media).
- Builder document **fixtures** (including one out of date, to test migrations).
- Every vertical increment ships its own tests (DoD in [10-acceptance-criteria]).

## Security as a test

- Negative tests: draft not visible in the public API; preview without token → 401; spoofed
  MIME rejected; invalid postMessage origin discarded; editor without `users.manage` → 403;
  rate limit → 429.

## Target coverage

- Domain (`cms-core`, `builder-core`, `schemas`): high (≥85%).
- HTTP/UI layers: coverage by acceptance criteria, not by percentage.

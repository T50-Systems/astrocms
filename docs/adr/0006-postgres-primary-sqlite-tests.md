# ADR-0006 — PostgreSQL primary; SQLite only for pure unit tests

- **Status:** Accepted
- **Date:** 2026-07-10
- **Decision:** PostgreSQL is the database in dev, integration testing, and production. SQLite is
  allowed **only** for unit tests that don't depend on Postgres-specific features.

## Context

The brief prefers Postgres and allows SQLite in dev "only if it doesn't introduce serious
divergence." The model uses **JSONB**, `gen_random_uuid()`, GIN indexes, and `timestamptz`:
features where SQLite diverges significantly.

## Decision

- **Dev and integration testing:** Postgres via `docker-compose` (fast to spin up).
- **Production:** Postgres.
- **SQLite:** acceptable for unit tests of logic that doesn't touch JSONB/indexes/Postgres types,
  to avoid paying the cost of starting a container for trivial tests. It is not a deployment path.
- Drizzle is configured against the Postgres dialect; two schema dialects are not maintained.

## Rationale

Keeping dev/prod parity avoids "works on my machine" bugs. Heavy use of JSONB (data,
tree, settings, seo) makes SQLite a real source of divergence, not a cosmetic one. The small
cost of running Postgres in dev is absorbed via Docker Compose.

## Consequences

- `pnpm db:*` points at Postgres; integration tests use an ephemeral DB (compose/testcontainers).
- No investment is made in full-schema SQLite compatibility (avoids work with no real use).

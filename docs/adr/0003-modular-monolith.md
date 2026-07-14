# ADR-0003 — Modular monolith with verified boundaries

- **Status:** Accepted
- **Date:** 2026-07-10
- **Decision:** A single server deployment (monolith) organized into packages with
  unidirectional dependencies verified in CI. No microservices in the MVP.

## Context

The brief prohibits microservices in the MVP and requires a "modular monolith with well-
separated packages," keeping CMS, builder, contracts, and adapters separate.

## Decision

- `cms-server` is the only backend process; everything else is a library or frontend app.
- Product separation lives in **packages**, not services.
- **Boundary rule** (dependency-cruiser) in CI:
  - `builder-*` **cannot** import `cms-core`, `cms-database`, `cms-auth`.
  - `cms-core` doesn't import from `apps/*` or Fastify (HTTP-free domain).
  - `contracts`/`schemas` don't depend on any domain code (leaves).
- The builder communicates with the CMS **only** via `cms-sdk` (runtime) and `contracts` (types).

## Consequences

- Extracting a service in the future (e.g. image processing) is viable because the domain is
  already isolated from HTTP and boundaries are explicit.
- The operational cost of the MVP is minimal (one backend, one Astro, Postgres, storage).
- Coupling violations fail the pipeline, rather than being caught in manual review.

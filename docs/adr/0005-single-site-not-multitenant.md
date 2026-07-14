# ADR-0005 — Single-site now, multisite-ready in the model

- **Status:** Accepted
- **Date:** 2026-07-10
- **Decision:** MVP with **one installation per client** (single-site). `site_id` is included
  in content tables, but multitenancy is **not** implemented (no per-tenant isolation,
  no domain-based routing, no per-tenant limits).

## Context

The brief calls for a per-client installation in v1 while also asking to "avoid decisions that
would make multiple sites impossible in the future," without implementing full multitenancy yet.

## Decision

- A `sites` table exists with **one** seeded row; its `id` is resolved once at startup.
- Content tables carry `site_id` (FK) from the initial migration → avoids a destructive
  future migration.
- MVP queries filter by that single `site_id` via a central helper; there is no per-request-
  tenant isolation logic, quotas, or tenant onboarding.
- Auth/roles are per-site in the schema, but operate on the single site.

## Consequences

- Nearly zero present cost (one column + one filter), high future benefit.
- When multisite is tackled, the work will be: tenant resolution by domain/host, isolation,
  and quotas — **not** a schema overhaul.
- Avoids the over-engineering trap: no multi-tenant panel/onboarding is built now.

# ADR-0008 — Infrastructure-agnostic via ports and adapters

- **Status:** Accepted
- **Date:** 2026-07-10
- **Decision:** The platform doesn't depend on any specific infrastructure provider. Every
  infrastructure resource is consumed through a **port** (TS interface) with at least one
  **default adapter with zero external dependencies**. The only **mandatory** backing service
  is a **PostgreSQL-compatible SQL** database.

## Context

Project requirement: the tool must be embeddable in any future Astro project and deployable
anywhere (own VPS, container, PaaS, on-premise), without being tied to a specific cloud,
proprietary bucket, queue broker, or APM. At the same time, we don't want over-engineering:
Postgres is indeed a hard dependency, but it's **vendor-neutral** (open protocol, dozens of
providers: self-hosted, RDS/Aurora, Cloud SQL, Neon, Supabase, Timescale…).

## Decision: hexagonal architecture (ports & adapters)

Every infrastructure dependency lives behind an interface in its own package. The domain
(`cms-core`, `builder-core`) only knows the port, never the provider.

| Port (interface) | Package | Default adapter (0 infra) | Optional adapters |
|---|---|---|---|
| `StorageDriver` (files) | `storage` | **local filesystem** | S3, R2, MinIO, GCS (S3-compat) |
| `CacheDriver` | `cms-core/cache` | **in-memory** (LRU) | Redis / KeyDB / Valkey |
| `JobQueue` (tasks) | `cms-core/jobs` | **in-process** (async) | BullMQ/Redis, PGBoss (on top of the DB itself) |
| `Mailer` (email) | `cms-core/mail` | **noop + log** (or SMTP) | SMTP, or provider via plugin |
| `SecretsProvider` | `cms-core/config` | **env vars** (12-factor) | Vault, SSM, Doppler (plugin) |
| `Clock` / `IdGenerator` | `cms-core` | standard functions | injectable in tests |
| `Logger` | `cms-core/log` | **stdout JSON** (pino) | pluggable destination/APM |
| `StorageSigner` (signed URLs) | `storage` | local HMAC signing | native S3 provider signing |

Rules:
- **Config via environment variables** (12-factor). No hardcoded paths/credentials; the
  `driver` is chosen via env (`STORAGE_DRIVER`, `CACHE_DRIVER`, …).
- **Adapter selection at the edge** (`cms-server`'s composition root), injected into the
  domain. The domain receives already-resolved ports; it never does `if (provider === 's3')`.
- **Minimal bootstrap:** with only Postgres + filesystem + in-memory, the whole platform works.
  Redis, S3, SMTP, etc. are **enhancements**, not requirements.

## Runtime portability

- **Backend:** Node ≥20 with standard APIs; packaged as an **OCI image** → runs on Docker,
  Kubernetes, Nomad, PaaS (Fly, Railway, Render, Coolify), or a VPS with systemd. No proprietary
  serverless APIs. The **domain knows nothing about HTTP** (ADR-0003), so the transport is
  swappable.
- **Astro:** **Node standalone** adapter by default (ADR-0002). The project can switch Astro's
  deployment adapter **without touching the CMS or contracts** — the integration is via public
  API + SDK.
- **Database:** standard SQL via Drizzle + the `postgres` driver. Provider-specific extensions
  and SQL are **avoided**; only core Postgres features are used (JSONB, GIN, `timestamptz`,
  `gen_random_uuid()` from `pgcrypto`, available on all providers). `DATABASE_URL` connects
  to any managed or self-hosted Postgres.

## What we do NOT do (avoiding over-abstraction)

- We don't abstract the database behind a generic "any DB" port: Postgres is the hard
  dependency and is already vendor-neutral. Abstracting it would add complexity with no real benefit.
- We don't implement every adapter now: the MVP ships the **defaults** + S3/MinIO
  (to validate the storage port). Redis/BullMQ/Vault arrive when a deployment needs them.

## Consequences

- **Real portability:** the same artifact runs on a €5 VPS or on managed Kubernetes, with no
  code changes, only environment variables.
- **Testability:** ports are swapped for in-memory fakes in tests (already planned in the
  builder's `inMemoryAdapter` and in `Clock`/`IdGenerator`).
- **Verification:** the boundary rule (ADR-0003) is extended: the domain cannot import
  provider SDKs (`@aws-sdk/*`, `ioredis`, …) directly; only adapters do. Checked in CI with
  `dependency-cruiser`.
- **Cost:** an explicit composition root and injection discipline. Acceptable and already
  implicit in the storage design.

# ADR-0002 — Astro rendering strategy: static, SSR, or hybrid

- **Status:** Accepted
- **Date:** 2026-07-10
- **Decision:** **Hybrid with on-demand SSR by default** (Node adapter), with optional per-project
  static export for high-traffic sites. The preview route is **always** SSR.

## Context

- The **client publishes without touching Git/terminal**: on clicking "Publish", the content must
  already be visible, with no manual rebuild.
- There are **drafts and preview** requiring per-request rendering with authorization (preview token).
- The CMS is the **source of truth**; content changes frequently editorially.
- Good public performance and security are required (the public never sees drafts).

## Options

1. **Pure static (SSG).** Maximum performance and minimal cost, but **every publish requires
   a rebuild + redeploy**. This conflicts with "publish without touching a terminal" unless a
   webhook→rebuild is automated, which adds latency (seconds-minutes) and deployment complexity.
   Draft preview doesn't fit static.
2. **On-demand SSR (Node adapter).** Each request is rendered against the CMS's public API.
   Publishing is **instant**. Supports authorized preview naturally. Requires a live Node
   process and a **caching layer** for performance. Fits self-hosting (Node is already there).
3. **Hybrid.** Choose per route: most SSR (or static with revalidation), forcing SSR where
   needed (preview, dynamic routes).

## Decision

**Hybrid with SSR by default:**
- `output: 'server'` with a Node adapter (`@astrojs/node`).
- Public pages: SSR against `GET /api/v1/public/...`, with **HTTP caching** (Cache-Control +
  optional in-memory/Redis cache) and invalidation via the `entry.published` webhook.
- **Preview route `/__builder/preview/:id`: SSR mandatory**, `prerender = false`, authorized
  by token; never cached; renders the **real draft**.
- Theme assets (project CSS/JS) are served statically/via CDN as usual.
- **Escape hatch:** a very stable marketing project can enable static export +
  webhook→rebuild; the CMS and contracts don't change, only that Astro's deployment config.

## Rationale

Instant publishing and draft preview are hard requirements of the brief; both are satisfied
naturally with SSR and poorly with pure SSG. The cost of SSR (Node process + cache) is acceptable
because the deployment is already self-hosted on Node and the volume is moderate. The hybrid
approach leaves the door open to static where performance/cost justify it, without coupling that
decision to the core.

## Consequences

- `apps/astro-demo` uses `@astrojs/node` in `standalone` mode (container in compose).
- A **caching layer** is defined with an optional interface (Redis not required in the MVP:
  in-memory cache by default, pluggable Redis driver later).
- Invalidation is anchored to the publish webhook (already present in the data model).
- Security: public rendering uses **only** the public API (never admin credentials); the
  preview uses a short-lived token.

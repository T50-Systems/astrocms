# AGENTS.md

## Conventions

- Blocks: `src/builder/blocks/<type>.ts` with `defineBlock`.
- Astro components for blocks: `src/components/builder/<Name>.astro`.
- Content types: `src/content-types/<key>.ts`.
- Builder config: `src/builder/config.ts`.
- CMS config: `astrocms.config.ts`.

## CLI

- `astrocms manifest --json`: prints the active `BlockManifest`.
- `astrocms validate`: validates the manifest/demo blocks and exits non-zero on errors.
- `astrocms generate block <type> --category <cat> [--dir <path>]`: idempotently creates a `.ts` descriptor and `.astro` component.
- `astrocms db:migrate`: runs migrations using `DATABASE_URL`.
- `astrocms db:seed`: idempotently creates demo data using `DATABASE_URL`.

## Hard Limits

- Do not introduce free-form HTML/CSS/JS as an AI editing surface.
- AI may only operate on fields, tokens, content types, `BuilderCommand[]`, and Zod-validated documents.
- `apply_document_ops` only accepts the `BuilderCommand` union; invalid commands are rejected before saving.
- Do not publish, change permissions, or touch global configuration outside of explicit tools/contracts.
- Do not expose secrets in logs, errors, snapshots, or fixtures.

## Tests and Local DB

Expected local Postgres:

```powershell
$env:DATABASE_URL="postgres://astrocms:astrocms@127.0.0.1:5434/astrocms"
```

Main verification:

```powershell
pnpm -r typecheck
pnpm --filter @astrocms/cli test
pnpm --filter @astrocms/mcp test
```

Migrations and seed:

```powershell
pnpm --filter @astrocms/cli exec astrocms db:migrate
pnpm --filter @astrocms/cli exec astrocms db:seed
```

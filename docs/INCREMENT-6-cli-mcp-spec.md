# Increment 6 (spec) — `astrocms` CLI + MCP server (AI-native)

Specification for the **AI-native** layer ([ADR-0009](adr/0009-ai-native-safe-operations.md),
[12-ai-native](12-ai-native.md)): letting an AI agent operate the CMS/project safely,
through the same contracts a human uses.

## Principle (reminder)

The AI is **just another client of the same contracts**. The CLI and the MCP do not open a privileged channel:
they validate with Zod, respect RBAC, and never accept free HTML/CSS/JS. Every operation is auditable.

## Part A — CLI `@astrocms/cli` (`astrocms`)

Idempotent commands, with `--json` for consumption by agents and clear exit codes:

| Command | Effect |
|---|---|
| `astrocms generate block <type> --category <cat>` | Scaffolds `src/builder/blocks/<type>.ts` (defineBlock) + `src/components/builder/<Name>.astro` and registers it in the `registry`/config |
| `astrocms add content-type <key> --kind <page\|post\|custom>` | Creates `src/content-types/<key>.ts` |
| `astrocms generate types` | Generates TS types from content types/manifest |
| `astrocms manifest --json` | Prints the `BlockManifest` (for introspection) |
| `astrocms validate` | Validates blocks/config/documents; exits ≠0 on errors |
| `astrocms db:migrate` / `db:seed` | Wraps the `cms-database` equivalents |

Implementation: `@astrocms/cli` package with `bin`, a lightweight args parser (no heavy deps or
`commander`), structured output. Actionable errors (`code`, `path`, suggestion). Reuses
`@astrocms/schemas` (defineBlock/buildManifest) and `@astrocms/cms-database`.

## Part B — MCP server `@astrocms/mcp`

Exposes the CMS as **typed tools** (MCP protocol, vendor-neutral) for agents:

| Tool | Effect | Security |
|---|---|---|
| `get_manifest`, `list_content_types`, `describe_field_types` | Introspection | read |
| `query_entries`, `get_entry`, `list_media` | Structured reads | read RBAC |
| `create_page`, `update_entry`, `publish_entry` | Writes via use cases | RBAC + Zod validation |
| `apply_document_ops` | Applies validated `BuilderCommand[]` to a document (via builder-core + adapter) | validated against the manifest |
| `validate_document`, `validate_entry` | Verifies before saving | — |
| `register_block` | Scaffolds+registers a block (equivalent to the CLI) | — |

- Authenticates with a **service API key** or a session; acts with concrete permissions (no implicit root).
- Each tool validates its input with the corresponding contract's Zod schema and returns the same
  typed `ApiError` on failure → the agent self-corrects.
- **Does not execute arbitrary code**; `apply_document_ops` only accepts commands from the `BuilderCommand` union.

## Part C — Project `AGENTS.md`

The installer generates an `AGENTS.md` at the root of the Astro project (for coding agents) with:
block/content-type location conventions, CLI commands, hard boundaries (no free-form
HTML/CSS/JS, only schema tokens/fields), and how to run tests/migrations.

## Verification

- CLI: `astrocms manifest --json` produces valid JSON; `astrocms validate` exits 0 on the demo;
  `astrocms generate block test/foo` creates the files and `pnpm --filter astro-demo typecheck` still passes.
- MCP: a test that starts the MCP server in-process, calls `get_manifest` and `apply_document_ops`
  with a valid command (applied) and an invalid one (rejected with a typed error, no mutation).
- `pnpm -r typecheck` passing. No file >500 LOC.

## Notes

- This is the realization of the user's second hard requirement ("easy for AI to operate").
- The MCP reuses `cms-sdk` + `builder-core` + `builder-adapters`; it does not reimplement domain logic.
- Coexists with infrastructure-agnosticism: the `AiProvider` (the panel's assistant for the client) is a
  separate optional port; the CLI/MCP do not depend on any AI provider.

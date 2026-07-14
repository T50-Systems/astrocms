# ADR-0009 — AI-operable, safe by construction

- **Status:** Accepted
- **Date:** 2026-07-10
- **Decision:** The platform is designed to be operated by both people and AI agents. **Every**
  AI action — building the site (dev) or editing content (client) — goes through the **same
  typed, validated, versioned contracts** a human uses. AI has **no** privileged channel and
  cannot inject free-form JS/CSS/HTML.

## Context

Two AI use cases, with the same security rule:

1. **Dev + AI (build-time):** I build the Astro site with the help of a coding agent (e.g.
   Claude Code). The agent must be able to register content types and blocks, scaffold
   components, introspect the system, and not make mistakes due to ambiguous conventions.
2. **Client + AI (runtime):** an optional assistant inside `/admin` helps a non-technical
   client ("add a hero with this text," "improve the SEO," "generate the alt text for this image").

The risk: AI becoming a vector for injecting unsafe or inconsistent content.
The mitigation already exists in the design: **JSON document + commands + manifest + Zod**. This
ADR declares it as a principle and defines the surfaces.

## Decision

### Single principle
AI is **just another client of the same contracts**. It produces:
- `BuilderCommand` / `setProp {nodeId, path, value}` validated against the `BlockManifest`
  (parent/child constraints, Zod field types, allowed tokens), **never** HTML.
- `CreateEntryRequest` / `UpdateEntryRequest` validated by the content type.
- Operations that respect **RBAC** (AI acts with a real user's session/permissions).
Any invalid output is rejected exactly like a human's; the AI receives the typed error and retries.

### Surface for Dev + AI (code readability and control)
- **Deterministic conventions:** fixed location and shape for blocks (`src/builder/blocks/*.ts`),
  content types, and config, so an agent knows where to write without guessing.
- **Declarative schemas** (`defineBlock`, `defineContentType`): a single definition → types, Zod,
  form, defaults, docs (see [06-block-registry](../06-block-registry.md)).
- **CLI + codegen** (`astrocms`): `generate block`, `add content-type`, `generate types`,
  `db:migrate`, `validate` — idempotent, scriptable commands an agent invokes with structured
  output (JSON) and clear exit codes.
- **MCP server** (`@astrocms/mcp`): exposes typed introspection and operation tools
  (`get_manifest`, `list_content_types`, `register_block`, `create_page`, `apply_document_ops`,
  `query_entries`, `validate_document`) so an agent can operate the CMS/project natively.
- **Machine-readable contracts:** OpenAPI generated from Zod, a serializable `BlockManifest`, and
  exportable JSON Schemas → the system is **self-describing**.
- **`AGENTS.md`** at the root of the generated project: rules, conventions, commands, and limits,
  written for an agent to follow.
- **Actionable errors:** messages with `code`, `path`, and a suggestion → the AI self-corrects.

### Surface for Client + AI (optional panel assistant)
- It's an optional **plugin** (`aiAssistantPlugin()`), disableable. The CMS works without it.
- It translates natural language into **validated document operations** (the same builder
  commands); the user **previews and confirms** before applying/publishing. Undo is available.
- Bounded content assistance: generating/improving `text`/`richText` field content, suggesting
  `SeoMeta`, generating image `alt` text. It never creates props outside the schema or
  disallowed tokens.
- **Provider-agnostic AI:** behind an `AiProvider` port (see [ADR-0008](0008-infrastructure-agnostic.md));
  the client chooses the model/provider or disables it. No provider wired in by default.

### Non-technical client (without AI)
Ease of use doesn't depend on AI: page templates, reusable patterns, sensible defaults,
jargon-free copy, live preview, publishing with confirmation, and undo/revisions. AI is a
convenience **on top of** an already-simple panel.

## Consequences

- The command/document model wasn't just for undo/redo: it's the **safe API for AI**.
  Reinforces the decision in [ADR-0004](0004-document-json-model.md).
- A new `@astrocms/mcp` package and an `astrocms` CLI join the roadmap (Milestones 3–7, not
  blocking the core MVP).
- The panel assistant and the `AiProvider` are optional and agnostic → they don't compromise
  infrastructure-agnosticism or the "the CMS works without extras" criterion.
- Added to the testing strategy: an AI/agent that emits invalid operations must be rejected
  exactly like a human client (contract tests).

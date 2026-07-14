# 12 — AI-native experience and ease of use

Three audiences, one single security rule ([ADR-0009](adr/0009-ai-native-safe-operations.md)):
AI is **just another client of the same contracts** — typed, validated, versioned — never a
privileged channel or free-form JS/CSS/HTML.

```
Dev + AI (build-time)      Client + AI (runtime)         Client without AI
  edits the CODE              edits the CONTENT             edits the CONTENT
  CLI · codegen · MCP         panel assistant                guided panel
  AGENTS.md · manifest        → validated commands           templates · patterns
        │                            │                            │
        └──────────── same contracts + Zod + RBAC ──────────────┘
```

## 1. Dev + AI — building the site with a coding agent

Goal: allow an agent (Claude Code or another) to add the CMS to an Astro project and
register content/blocks **without guessing**, with immediate feedback.

### 1.1 Deterministic conventions
Fixed locations and shapes (the agent knows where to write):
```
src/builder/blocks/<type>.ts        # defineBlock (declarative schema)
src/builder/config.ts               # defineBuilderConfig (block list)
src/content-types/<key>.ts          # defineContentType
src/components/builder/<Name>.astro  # component that renders the block
astrocms.config.ts                  # defineCmsConfig (editors, plugins, theme)
```

### 1.2 Declarative schemas → everything derived
One definition produces TS types, Zod, the inspector form, defaults, and docs. The agent writes
little, in a predictable way; the compiler and Zod catch mistakes. (See [06-block-registry](06-block-registry.md).)

### 1.3 `astrocms` CLI (idempotent, scriptable, JSON output)
```
astrocms generate block <type> --category Marketing   # scaffolds .ts + .astro + registers it
astrocms add content-type <key> --kind custom
astrocms generate types                               # types from content types/manifest
astrocms validate                                     # validates blocks, config and documents
astrocms db:migrate | db:seed
astrocms manifest --json                              # prints the BlockManifest
```
Every command: a clear exit code, `--json` for AI consumption, and actionable error messages
(`code`, `path`, suggestion). An agent can chain them and react to the result.

### 1.4 MCP server (`@astrocms/mcp`)
Exposes the CMS/project as **typed tools** for agents (open, vendor-neutral protocol):

| MCP tool | Effect |
|---|---|
| `get_manifest` / `list_content_types` / `describe_field_types` | Introspection: the AI discovers the system |
| `register_block` | Scaffolds and registers a block (equivalent to the CLI) |
| `create_page` / `update_entry` | Creates/edits content via contracts (RBAC) |
| `apply_document_ops` | Applies validated `BuilderCommand[]` to a document |
| `validate_document` / `validate_entry` | Verifies before saving |
| `query_entries` / `list_media` | Structured reads |

The MCP server does **not** execute arbitrary code: every tool validates against Zod/the manifest and
respects permissions. It is the "native" way for an AI to operate the platform safely.

### 1.5 Self-describing contracts
- **OpenAPI** generated from Zod (`/api/v1/openapi.json`).
- Serializable **BlockManifest** (`/api/v1/builder/manifest`).
- Exportable **JSON Schemas** for the document, entry, and fields.
An agent can read the entire system without human-written documentation.

### 1.6 `AGENTS.md`
The installer generates an `AGENTS.md` at the project root with: location conventions,
CLI commands, what's allowed/forbidden (no free HTML/CSS/JS, tokens only),
how to register a block, how to run tests/migrations. Written so an agent can follow it literally.

## 2. Client + AI — panel assistant (optional)

Optional plugin (`aiAssistantPlugin()`); the CMS works without it. A provider sits behind the
`AiProvider` port ([ADR-0008](adr/0008-infrastructure-agnostic.md)) → the operator chooses a model or disables it.

- **Build/edit via natural language:** "add a hero with this title and this image" →
  the assistant proposes `BuilderCommand[]`; the user **sees the preview and confirms**; it's applied
  with undo available. Operations are validated against the manifest: only allowed blocks and props.
- **Scoped content assistance:** generate/improve text for `text`/`richText` fields, suggest
  `SeoMeta` (title/description), generate image `alt` text, propose a slug. Always over schema
  fields; it never invents props or out-of-catalog tokens.
- **Hard limits:** it does not publish without confirmation, does not change permissions/users, does
  not touch global settings except with explicit permission, does not introduce free-form styles/code.

```ts
// conceptual shape of the port (provider-agnostic)
interface AiProvider {
  suggestDocumentOps(input: { prompt: string; manifest: BlockManifest; document: BuilderDocument })
    : Promise<{ ops: BuilderCommand[]; explanation: string }>;
  improveText(input: { field: "text" | "richText"; value: string; intent: string }): Promise<string>;
  suggestSeo(input: { title: string; body: string }): Promise<SeoMeta>;
  altText(input: { assetId: ID }): Promise<string>;
}
```

## 3. Client without AI — still easy

Simplicity does **not** depend on AI (which is a convenience layered on top):

- **Page templates** and **reusable patterns** → you never start from a blank page.
- **Sensible defaults** on every block; the inspector only shows allowed props, with
  semantic controls (tokens, not raw numbers).
- **Live preview**, inline editing, **undo/redo**, revisions and **publish with confirmation**.
- **Jargon-free copy**, guided empty states ("no pages yet — create the first one"), errors
  in plain language.
- Panel **accessibility** (labels, focus, roles) as a requirement, not optional.

## 4. How this connects to what's already designed

- The **command model + JSON document + manifest** (ADR-0004) is, besides the
  undo/redo engine, the **safe API for AI**: that's why an AI can edit without risk.
- **RBAC** applies equally to AI and humans: the assistant acts under a user's session and permissions.
- **Infrastructure-agnostic** (ADR-0008): the `AiProvider` is an optional port; without a provider,
  the whole system keeps working.
- **Versioning and migrations:** AI operates on versioned contracts; its changes go through
  revisions and are reversible like any other.

# ADR-0004 — Visual content as a versioned JSON tree (not HTML)

- **Status:** Accepted
- **Date:** 2026-07-10
- **Decision:** The builder stores a **JSON node tree** (`BuilderDocument`), never HTML.
  Each node carries a block schema `version`; the document carries a `schemaVersion`.

## Context

Hard requirement: "visual content as structured JSON, never arbitrary HTML," with support for
block migrations, revision comparison, cloning, and validation. The client must not be able to
inject free-form JS/CSS/HTML.

## Decision

- Document = `{ id, schemaVersion, root, meta }`; `root` is a recursive `BuilderNode`
  (`id`, `type`, `version`, `props`, `children`, `hidden?`, `locked?`).
- Props **do not** contain HTML or free-form styles: they use typed fields from the field
  system (semantic tokens, `MediaRef`, `EntityRef`, sanitized Tiptap JSON).
- **Astro** is what converts the tree into HTML via the registered components.
- Per-block migrations (`from → to`) are applied on load if the node is out of date.

## Rejected alternatives

- **Persisted HTML/`contenteditable`:** impossible to validate, migrate, version, or protect against XSS.
- **Markdown for everything:** insufficient for layout/props of rich blocks.

## Consequences

- Validation (`ValidationResult`), revision diffing, and cloning operate on structured data.
- Inline editing translates to `setProp {nodeId, path, value}` — the JSON remains the source of truth.
- Changing a block's rendering (same schema) doesn't require migrating documents.
- Adds the responsibility of maintaining migrations when evolving a block (accepted).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCmsCore, type CmsCore } from "@astrocms/cms-core";
import { createDb, type Database } from "@astrocms/cms-database";
import { createAstroCmsMcpServer, type AstroCmsMcpTools } from "./index.js";

const DB = process.env.DATABASE_URL;

describe.skipIf(!DB)("@astrocms/mcp tools", () => {
  let close: () => Promise<unknown>;
  let db: Database;
  let core: CmsCore;
  let tools: AstroCmsMcpTools;

  beforeAll(() => {
    const conn = createDb(DB!, { max: 3 });
    db = conn.db;
    close = conn.close;
    core = createCmsCore({ db });
    const runtime = createAstroCmsMcpServer({ db, core });
    tools = runtime.tools;
  });

  afterAll(async () => {
    await close();
  });

  it("get_manifest devuelve blocks", async () => {
    const result = await tools.get_manifest({});

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.blocks.length).toBeGreaterThan(0);
  });

  it("get_document devuelve el borrador de una página builder", async () => {
    const created = await tools.create_page({
      title: "MCP document test",
      slug: `/mcp-document-${Date.now()}`,
      editorType: "builder",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(created.error.message);
    const documentId = created.data.builderDocumentId;
    if (!documentId) throw new Error("builderDocumentId no fue creado");

    const result = await tools.get_document({ documentId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.document.root.type).toBe("core/page");
  });

  it("apply_document_ops muta con insertNode valido y rechaza comandos invalidos sin mutar", async () => {
    const slug = `/mcp-${Date.now()}`;
    const created = await tools.create_page({ title: "MCP test", slug, editorType: "builder" });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(created.error.message);
    const documentId = created.data.builderDocumentId;
    expect(documentId).toBeDefined();
    if (!documentId) throw new Error("builderDocumentId no fue creado");

    const valid = await tools.apply_document_ops({
      documentId,
      ops: [
        {
          kind: "insertNode",
          parentId: "root",
          index: 0,
          node: {
            id: "hero-mcp",
            type: "site/hero",
            version: 1,
            props: { title: "Hero MCP" },
            children: [],
          },
        },
      ],
    });
    expect(valid.ok).toBe(true);

    const published = await tools.publish_document({ documentId });
    expect(published).toEqual({ ok: true, data: { published: true, documentId } });

    const revisions = await tools.list_document_revisions({ documentId });
    expect(revisions.ok).toBe(true);
    if (!revisions.ok) throw new Error(revisions.error.message);
    expect(revisions.data.revisions.length).toBeGreaterThanOrEqual(1);

    const restored = await tools.restore_document_revision({
      documentId,
      revisionId: revisions.data.revisions[0]!.id,
    });
    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.data.document.id).toBe(documentId);

    const afterValid = await core.builder.get(documentId);
    const snapshot = JSON.stringify(afterValid);

    const invalid = await tools.apply_document_ops({
      documentId,
      ops: [{ kind: "notACommand", nodeId: "hero-mcp" }],
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.code).toBe("validation_error");

    const afterInvalid = await core.builder.get(documentId);
    expect(JSON.stringify(afterInvalid)).toBe(snapshot);
  });

  it("get_ai_guidelines y get_design_tokens devuelven sus grupos de settings", async () => {
    const [guidelines, tokens] = await Promise.all([tools.get_ai_guidelines({}), tools.get_design_tokens({})]);

    expect(guidelines.ok).toBe(true);
    if (guidelines.ok) expect(guidelines.data.group).toBe("ai-guidelines");
    expect(tokens.ok).toBe(true);
    if (tokens.ok) expect(tokens.data.group).toBe("design-tokens");
  });
});

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
});

import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import type { BuilderDocument } from "@astrocms/contracts";
import { createInMemoryAdapter } from "./in-memory.js";
import { createJsonFileAdapter } from "./json-file.js";
import type { BuilderStorageAdapter } from "./adapter.js";

const fixedClock = { now: () => new Date("2026-07-10T00:00:00.000Z") };

function doc(id: string, title: string): BuilderDocument {
  return {
    id,
    schemaVersion: 1,
    root: { id: "root", type: "core/page", version: 1, props: {}, children: [] },
    meta: { title },
  };
}

async function roundTrip(adapter: BuilderStorageAdapter) {
  await adapter.saveDraft(doc("d1", "v1"));
  await adapter.saveDraft(doc("d1", "v2"));
  await adapter.publish("d1");

  const loaded = await adapter.loadDocument("d1");
  expect(loaded.meta?.title).toBe("v2");

  const revs = await adapter.getRevisionHistory("d1");
  expect(revs.length).toBe(2);
  expect(revs[0]?.isPublished).toBe(true); // la más reciente, publicada

  const restored = await adapter.restoreRevision("d1", "1");
  expect(restored.meta?.title).toBe("v1");
  expect((await adapter.getRevisionHistory("d1")).length).toBe(3);
}

describe("builder-adapters", () => {
  const file = join(tmpdir(), `astrocms-adapter-${process.pid}.json`);
  afterAll(() => rm(file, { force: true }));

  it("inMemory: round-trip draft/publish/revisiones/restore", async () => {
    await roundTrip(createInMemoryAdapter({ clock: fixedClock }));
  });

  it("jsonFile: round-trip persistente", async () => {
    await roundTrip(createJsonFileAdapter({ path: file, clock: fixedClock }));
  });

  it("son intercambiables (misma interfaz)", async () => {
    const adapters: BuilderStorageAdapter[] = [
      createInMemoryAdapter({ clock: fixedClock }),
      createJsonFileAdapter({ path: file + ".2", clock: fixedClock }),
    ];
    for (const a of adapters) {
      await a.saveDraft(doc("x", "t"));
      expect((await a.loadDocument("x")).id).toBe("x");
    }
    await rm(file + ".2", { force: true });
  });
});

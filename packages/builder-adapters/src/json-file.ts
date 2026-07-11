import { readFile, writeFile } from "node:fs/promises";
import type { BuilderDocument, BuilderRevision } from "@astrocms/contracts";
import { systemClock, type AdapterClock, type BuilderStorageAdapter } from "./adapter.js";

interface StoredFile {
  docs: Record<string, { current: BuilderDocument; revisions: Array<BuilderRevision & { doc: BuilderDocument }> }>;
}

export interface JsonFileOptions {
  path: string;
  clock?: AdapterClock;
  createdBy?: string;
}

/** Adaptador de fichero JSON: para desarrollo local sin CMS. */
export function createJsonFileAdapter(opts: JsonFileOptions): BuilderStorageAdapter {
  const clock = opts.clock ?? systemClock;
  const createdBy = opts.createdBy ?? "system";

  async function read(): Promise<StoredFile> {
    try {
      return JSON.parse(await readFile(opts.path, "utf8")) as StoredFile;
    } catch {
      return { docs: {} };
    }
  }
  const write = (data: StoredFile) => writeFile(opts.path, JSON.stringify(data, null, 2), "utf8");

  return {
    async loadDocument(id) {
      const data = await read();
      const entry = data.docs[id];
      if (!entry) throw new Error(`documento '${id}' no existe`);
      return entry.current;
    },

    async saveDraft(document) {
      const data = await read();
      const entry = data.docs[document.id] ?? { current: document, revisions: [] };
      entry.current = document;
      entry.revisions.push({
        id: String(entry.revisions.length + 1),
        createdAt: clock.now().toISOString(),
        createdBy,
        note: "draft",
        isPublished: false,
        doc: document,
      });
      data.docs[document.id] = entry;
      await write(data);
    },

    async publish(documentId) {
      const data = await read();
      const entry = data.docs[documentId];
      if (!entry) throw new Error(`documento '${documentId}' no existe`);
      entry.revisions.forEach((r) => (r.isPublished = false));
      const last = entry.revisions[entry.revisions.length - 1];
      if (last) last.isPublished = true;
      await write(data);
    },

    async getRevisionHistory(documentId) {
      const data = await read();
      const entry = data.docs[documentId];
      if (!entry) return [];
      return entry.revisions.map(({ doc: _doc, ...rev }) => rev).reverse();
    },

    async restoreRevision(documentId, revisionId) {
      const data = await read();
      const entry = data.docs[documentId];
      if (!entry) throw new Error(`documento '${documentId}' no existe`);
      const rev = entry.revisions.find((r) => r.id === revisionId);
      if (!rev) throw new Error(`revisión '${revisionId}' no existe`);
      entry.current = rev.doc;
      entry.revisions.push({
        id: String(entry.revisions.length + 1),
        createdAt: clock.now().toISOString(),
        createdBy,
        note: `restaurado de rev ${revisionId}`,
        isPublished: false,
        doc: rev.doc,
      });
      await write(data);
      return entry.current;
    },
  };
}

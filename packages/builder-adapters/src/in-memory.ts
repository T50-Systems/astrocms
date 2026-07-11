import type { BuilderDocument, BuilderRevision } from "@astrocms/contracts";
import { systemClock, type AdapterClock, type BuilderStorageAdapter } from "./adapter.js";

interface Stored {
  current: BuilderDocument;
  revisions: Array<BuilderRevision & { doc: BuilderDocument }>;
}

export interface InMemoryOptions {
  seed?: BuilderDocument[];
  clock?: AdapterClock;
  createdBy?: string;
}

/** Adaptador en memoria: para tests y prototipos. No persiste entre procesos. */
export function createInMemoryAdapter(opts: InMemoryOptions = {}): BuilderStorageAdapter {
  const clock = opts.clock ?? systemClock;
  const createdBy = opts.createdBy ?? "system";
  const store = new Map<string, Stored>();

  for (const doc of opts.seed ?? []) {
    store.set(doc.id, { current: structuredClone(doc), revisions: [] });
  }

  function require(id: string): Stored {
    const s = store.get(id);
    if (!s) throw new Error(`documento '${id}' no existe`);
    return s;
  }

  function pushRevision(s: Stored, doc: BuilderDocument, note: string) {
    s.revisions.push({
      id: String(s.revisions.length + 1),
      createdAt: clock.now().toISOString(),
      createdBy,
      note,
      isPublished: false,
      doc: structuredClone(doc),
    });
  }

  return {
    async loadDocument(id) {
      return structuredClone(require(id).current);
    },

    async saveDraft(document) {
      const s = store.get(document.id) ?? { current: document, revisions: [] };
      s.current = structuredClone(document);
      pushRevision(s, document, "draft");
      store.set(document.id, s);
    },

    async publish(documentId) {
      const s = require(documentId);
      for (const r of s.revisions) r.isPublished = false;
      const last = s.revisions[s.revisions.length - 1];
      if (last) last.isPublished = true;
    },

    async getRevisionHistory(documentId) {
      return require(documentId).revisions
        .map(({ doc: _doc, ...rev }) => rev)
        .reverse();
    },

    async restoreRevision(documentId, revisionId) {
      const s = require(documentId);
      const rev = s.revisions.find((r) => r.id === revisionId);
      if (!rev) throw new Error(`revisión '${revisionId}' no existe`);
      s.current = structuredClone(rev.doc);
      pushRevision(s, s.current, `restaurado de rev ${revisionId}`);
      return structuredClone(s.current);
    },
  };
}

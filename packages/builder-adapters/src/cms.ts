import type { CmsClient } from "@astrocms/cms-sdk";
import type { BuilderStorageAdapter } from "./adapter.js";

/**
 * Adaptador de producción: implementa BuilderStorageAdapter sobre el SDK del CMS.
 * El builder no toca las tablas del CMS; sólo consume su API pública/administrativa.
 */
export function createCmsBuilderAdapter(cms: CmsClient): BuilderStorageAdapter {
  return {
    loadDocument: (id) => cms.builder.getDocument(id),
    saveDraft: (document) => cms.builder.saveDocument(document.id, document),
    publish: (documentId) => cms.builder.publish(documentId),
    getRevisionHistory: (documentId) => cms.builder.revisions(documentId),
    restoreRevision: (documentId, revisionId) => cms.builder.restore(documentId, revisionId),
  };
}

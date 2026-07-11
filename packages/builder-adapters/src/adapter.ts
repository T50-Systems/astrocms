import type { BuilderDocument, BuilderRevision } from "@astrocms/contracts";

/**
 * Única interfaz entre el builder y cualquier backend. El builder es agnóstico:
 * intercambiando el adaptador funciona con el CMS, en memoria (tests) o JSON local (dev).
 * (Media y manifiesto se sirven desde el adaptador del CMS; aquí, sólo documentos/revisiones.)
 */
export interface BuilderStorageAdapter {
  loadDocument(id: string): Promise<BuilderDocument>;
  saveDraft(document: BuilderDocument): Promise<void>;
  publish(documentId: string): Promise<void>;
  getRevisionHistory(documentId: string): Promise<BuilderRevision[]>;
  restoreRevision(documentId: string, revisionId: string): Promise<BuilderDocument>;
}

export interface AdapterClock {
  now(): Date;
}

export const systemClock: AdapterClock = { now: () => new Date() };

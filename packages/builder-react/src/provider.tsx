import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CmsClient } from "@astrocms/cms-sdk";
import { createEngine, type BuilderEngine, type BuilderState } from "@astrocms/builder-core";
import type { BlockManifest, BuilderDocument } from "@astrocms/contracts";

export interface BuilderStorageAdapterLike {
  loadDocument(id: string): Promise<BuilderDocument>;
  saveDraft(document: BuilderDocument): Promise<void>;
  publish(documentId: string): Promise<void>;
}

export interface BuilderProviderProps {
  document: BuilderDocument;
  manifest: BlockManifest;
  adapter: BuilderStorageAdapterLike;
  cms?: CmsClient | undefined;
  previewOrigin: string;
  previewToken?: string | undefined;
  channelId?: string | undefined;
  onSave?: ((document: BuilderDocument) => Promise<void> | void) | undefined;
  onPublish?: ((document: BuilderDocument) => Promise<void> | void) | undefined;
  children: ReactNode;
}

export interface BuilderContextValue {
  engine: BuilderEngine;
  state: BuilderState;
  manifest: BlockManifest;
  adapter: BuilderStorageAdapterLike;
  cms?: CmsClient | undefined;
  previewOrigin: string;
  previewToken?: string | undefined;
  channelId: string;
  onSave: (document: BuilderDocument) => Promise<void> | void;
  onPublish: (document: BuilderDocument) => Promise<void> | void;
}

const BuilderContext = createContext<Omit<BuilderContextValue, "state"> | null>(null);

export function BuilderProvider(props: BuilderProviderProps) {
  const engine = useMemo(
    () => createEngine(props.document, { manifest: props.manifest }),
    [props.document, props.manifest],
  );
  const channelId = useMemo(() => props.channelId ?? `astrocms-${props.document.id}-${Math.random().toString(36).slice(2)}`, [
    props.channelId,
    props.document.id,
  ]);

  const value = useMemo<Omit<BuilderContextValue, "state">>(
    () => ({
      engine,
      manifest: props.manifest,
      adapter: props.adapter,
      ...(props.cms ? { cms: props.cms } : {}),
      previewOrigin: props.previewOrigin,
      ...(props.previewToken ? { previewToken: props.previewToken } : {}),
      channelId,
      onSave: props.onSave ?? ((document) => props.adapter.saveDraft(document)),
      onPublish: props.onPublish ?? ((document) => props.adapter.publish(document.id)),
    }),
    [channelId, engine, props.adapter, props.cms, props.manifest, props.onPublish, props.onSave, props.previewOrigin, props.previewToken],
  );

  return <BuilderContext.Provider value={value}>{props.children}</BuilderContext.Provider>;
}

export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder debe usarse dentro de BuilderProvider");
  const state = useSyncExternalStore(
    (listener) => ctx.engine.subscribe(() => listener()),
    () => ctx.engine.getState(),
    () => ctx.engine.getState(),
  );
  return { ...ctx, state };
}

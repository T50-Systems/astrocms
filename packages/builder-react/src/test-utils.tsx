import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { CmsClient } from "@astrocms/cms-sdk";
import type { BlockManifest, BuilderDocument, BuilderNode } from "@astrocms/contracts";
import { BuilderProvider, type BuilderProviderProps, type BuilderStorageAdapterLike } from "./provider.js";

export function makeManifest(): BlockManifest {
  return {
    schemaVersion: 1,
    tokens: { spacing: [], widths: [], columns: [], colors: [], breakpoints: [{ name: "desktop" }] },
    blocks: [
      {
        type: "core/page",
        label: "Página",
        category: "Layout",
        version: 1,
        fields: [],
        defaults: {},
        constraints: { allowedChildren: ["core/heading", "core/paragraph"] },
        capabilities: { acceptsChildren: true, duplicable: false, removable: false, hideable: false },
        hasPreviewComponent: false,
      },
      {
        type: "core/heading",
        label: "Encabezado",
        category: "Contenido",
        version: 1,
        fields: [
          { key: "text", type: "text", label: "Texto", required: true, config: {} },
          { key: "level", type: "select", label: "Nivel", required: true, config: { options: ["h1", "h2"] } },
        ],
        defaults: { text: "Nuevo encabezado", level: "h2" },
        constraints: {},
        capabilities: { acceptsChildren: false, duplicable: true, removable: true, hideable: true },
        hasPreviewComponent: false,
      },
      {
        type: "core/paragraph",
        label: "Párrafo",
        category: "Contenido",
        version: 1,
        fields: [{ key: "text", type: "textarea", label: "Texto", required: true, config: {} }],
        defaults: { text: "Nuevo párrafo" },
        constraints: {},
        capabilities: { acceptsChildren: false, duplicable: true, removable: true, hideable: true },
        hasPreviewComponent: false,
      },
    ],
  };
}

export function makeDocument(root?: BuilderNode): BuilderDocument {
  return {
    id: "document-1",
    schemaVersion: 1,
    root: root ?? {
      id: "root",
      type: "core/page",
      version: 1,
      props: {},
      children: [{ id: "heading-1", type: "core/heading", version: 1, props: { text: "Hola", level: "h1" }, children: [] }],
    },
    meta: { title: "Documento de prueba" },
  };
}

export function makeAdapter(document = makeDocument()): BuilderStorageAdapterLike {
  return {
    loadDocument: async () => document,
    saveDraft: async () => undefined,
    publish: async () => undefined,
  };
}

export function makeCms(): CmsClient {
  return {
    media: { list: async () => ({ data: [], page: 1, pageSize: 50, total: 0 }) },
  } as unknown as CmsClient;
}

type BuilderOverrides = Partial<Omit<BuilderProviderProps, "children">>;

export function renderInBuilder(
  ui: React.ReactElement,
  overrides: BuilderOverrides = {},
  options?: RenderOptions,
): RenderResult {
  const document = overrides.document ?? makeDocument();
  return render(
    <BuilderProvider
      document={document}
      manifest={overrides.manifest ?? makeManifest()}
      adapter={overrides.adapter ?? makeAdapter(document)}
      cms={overrides.cms ?? makeCms()}
      previewOrigin={overrides.previewOrigin ?? "http://preview.test"}
      previewToken={overrides.previewToken ?? "preview-token"}
      channelId={overrides.channelId ?? "test-channel"}
      onSave={overrides.onSave}
      onPublish={overrides.onPublish}
      documentTitle={overrides.documentTitle}
      onExit={overrides.onExit}
      onRenameDocument={overrides.onRenameDocument}
    >
      {ui}
    </BuilderProvider>,
    options,
  );
}

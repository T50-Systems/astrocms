import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { createCmsBuilderAdapter } from "@astrocms/builder-adapters/cms";
import { Builder, BuilderProvider } from "@astrocms/builder-react";
import type { BuilderDocument, BuilderNode, Entry } from "@astrocms/contracts";
import { cms } from "../lib.ts";
import { Alert, errMsg } from "@/components/ui/alert.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

const routeApi = getRouteApi("/pages/$pageId/builder");

export function BuilderPage() {
  const { pageId } = routeApi.useParams();
  const qc = useQueryClient();
  const adapter = useMemo(() => createCmsBuilderAdapter(cms), []);
  const manifest = useQuery({ queryKey: ["builder-manifest"], queryFn: () => cms.builder.manifest() });
  const document = useQuery({
    queryKey: ["builder-document", pageId],
    queryFn: () => ensureBuilderDocument(pageId),
  });
  const token = useQuery({
    queryKey: ["preview-token", document.data?.id],
    enabled: Boolean(document.data?.id),
    queryFn: async () => cms.preview.createToken(document.data!.id),
  });

  if (manifest.isLoading || document.isLoading || token.isLoading) {
    return (
      <div aria-busy className="space-y-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  const error = manifest.error ?? document.error ?? token.error;
  if (manifest.isError || document.isError || token.isError || !manifest.data || !document.data || !token.data) {
    const err = error ?? new Error("No se pudo cargar el builder");
    return <Alert className="m-6">{errMsg(err)}</Alert>;
  }

  return (
    <>
      <div className="border-b px-3 py-2 text-sm">
        <Link to="/pages/$pageId" params={{ pageId }} className="text-primary hover:underline">Volver a edición</Link>
      </div>
      <BuilderProvider
        document={document.data}
        manifest={manifest.data}
        adapter={adapter}
        cms={cms}
        previewOrigin={import.meta.env.VITE_PREVIEW_ORIGIN ?? window.location.origin.replace(":5173", ":4321")}
        previewToken={token.data.token}
        onSave={async (doc) => {
          await adapter.saveDraft(doc);
          await qc.invalidateQueries({ queryKey: ["builder-document", pageId] });
        }}
        onPublish={async (doc) => {
          await adapter.saveDraft(doc);
          await adapter.publish(doc.id);
        }}
      >
        <Builder />
      </BuilderProvider>
    </>
  );
}

async function ensureBuilderDocument(pageId: string): Promise<BuilderDocument> {
  const page = await ensureBuilderPage(pageId);
  if (page.builderDocumentId) return cms.builder.getDocument(page.builderDocumentId);
  return cms.builder.create(defaultRoot(), page.id);
}

async function ensureBuilderPage(pageId: string): Promise<Entry> {
  const page = await cms.pages.get(pageId);
  if (page.editorType === "builder" && page.builderDocumentId) return page;
  return cms.pages.update(pageId, { editorType: "builder" });
}

function defaultRoot(): BuilderNode {
  return { id: "root", type: "core/page", version: 1, props: {}, children: [] };
}

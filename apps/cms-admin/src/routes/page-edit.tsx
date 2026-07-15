import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronUp, ExternalLink, LayoutTemplate } from "lucide-react";
import { useForm } from "react-hook-form";
import { cms } from "../lib.ts";
import { PageContainer } from "@/components/page-container.tsx";
import { Alert } from "@/components/ui/alert.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { PageEditSkeleton } from "@/components/skeletons.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";

const routeApi = getRouteApi("/pages/$pageId");
const previewOrigin = import.meta.env.VITE_PREVIEW_ORIGIN ?? "";

interface EditForm {
  title: string;
  body: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
}

const dateFmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });
function fmtDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : dateFmt.format(d);
}

function StatusBadge({ status }: { status: string }) {
  const published = status === "published";
  return <Badge variant={published ? "success" : "warning"}>{published ? "Publicada" : "Borrador"}</Badge>;
}

export function EditPage() {
  const { pageId } = routeApi.useParams();
  const qc = useQueryClient();
  const [seoOpen, setSeoOpen] = useState(false);

  const page = useQuery({ queryKey: ["page", pageId], queryFn: () => cms.pages.get(pageId) });
  const revisions = useQuery({ queryKey: ["revisions", pageId], queryFn: () => cms.pages.revisions(pageId) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["page", pageId] });
    qc.invalidateQueries({ queryKey: ["revisions", pageId] });
    qc.invalidateQueries({ queryKey: ["pages"] });
  };

  const isBuilder = page.data?.editorType === "builder";

  const save = useMutation({
    mutationFn: (v: EditForm) =>
      cms.pages.update(pageId, {
        title: v.title,
        // Las páginas visuales guardan su contenido en el documento del builder,
        // no en `data.body`: no lo sobreescribimos desde este editor de metadatos.
        ...(isBuilder ? {} : { data: { body: v.body } }),
        ...(v.slug.trim() ? { slug: v.slug.trim() } : {}),
        seo: {
          ...(v.seoTitle.trim() ? { title: v.seoTitle.trim() } : {}),
          ...(v.seoDescription.trim() ? { description: v.seoDescription.trim() } : {}),
        },
      }),
    onSuccess: invalidate,
  });
  const publish = useMutation({ mutationFn: () => cms.pages.publish(pageId), onSuccess: invalidate });
  const unpublish = useMutation({ mutationFn: () => cms.pages.unpublish(pageId), onSuccess: invalidate });
  const restore = useMutation({ mutationFn: (versionNo: number) => cms.pages.restore(pageId, versionNo), onSuccess: invalidate });

  const { register, handleSubmit } = useForm<EditForm>({
    values: {
      title: page.data?.title ?? "",
      body: typeof page.data?.data?.body === "string" ? page.data.data.body : "",
      slug: page.data?.slug ?? "",
      seoTitle: page.data?.seo.title ?? "",
      seoDescription: page.data?.seo.description ?? "",
    },
  });

  if (page.isLoading)
    return (
      <PageContainer>
        <PageEditSkeleton />
      </PageContainer>
    );
  if (page.isError || !page.data)
    return <PageContainer><Alert>{(page.error as Error)?.message ?? "No encontrada"}</Alert></PageContainer>;
  const p = page.data;

  const saveThenPublish = handleSubmit(async (v) => { await save.mutateAsync(v); await publish.mutateAsync(); });
  const busy = save.isPending || publish.isPending || unpublish.isPending;
  const err = save.error ?? publish.error ?? unpublish.error;

  return (
    <PageContainer>
      <div className="mb-5 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="size-4" /> Páginas</Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={p.status} />
          <Button variant="outline" size="sm" type="submit" form="page-form" loading={save.isPending} disabled={busy}>{save.isPending ? "Guardando…" : "Guardar borrador"}</Button>
          {p.status === "published" ? (
            <Button size="sm" type="button" onClick={() => unpublish.mutate()} disabled={busy}>Despublicar</Button>
          ) : (
            <Button size="sm" type="button" onClick={() => saveThenPublish()} loading={publish.isPending} disabled={busy}>{publish.isPending ? "Publicando…" : "Publicar"}</Button>
          )}
        </div>
      </div>

      {err && <Alert className="mb-3">{err.message}</Alert>}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form id="page-form" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
          <input aria-label="Título" placeholder="Añade un título" className="mb-3 w-full border-0 bg-transparent p-1 text-3xl font-bold outline-none placeholder:text-muted-foreground" {...register("title")} />
          {isBuilder ? (
            <Card className="flex flex-col items-start gap-3 border-dashed p-6">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <LayoutTemplate className="size-4 text-primary" /> Página visual
              </div>
              <p className="text-sm text-muted-foreground">
                El contenido de esta página se edita con el builder visual de bloques. Aquí solo gestionas el título, el
                ID en URL, el SEO y la publicación.
              </p>
              <Button asChild size="sm">
                <Link to="/pages/$pageId/builder" params={{ pageId }}>Abrir el builder</Link>
              </Button>
            </Card>
          ) : (
            <Textarea aria-label="Contenido" placeholder="Escribe el contenido de la página…" rows={16} className="min-h-96 text-base leading-relaxed" {...register("body")} />
          )}
        </form>

        <aside className="flex flex-col gap-3">
          <Card className="p-4">
            <div className="mb-1 text-sm font-semibold">Página</div>
            <dl className="text-sm">
              <Row label="Estado"><StatusBadge status={p.status} /></Row>
              <Row label="Guardada">{fmtDate(p.updatedAt)}</Row>
              <Row label="Versión">{p.currentVersionNo}</Row>
              <Row label="Autor">{p.authorName ?? "—"}</Row>
            </dl>
            <div className="mt-2 grid gap-1.5">
              <Label htmlFor="slug" className="text-xs text-muted-foreground">ID en URL</Label>
              <Input id="slug" className="h-8" form="page-form" {...register("slug")} />
            </div>
            {p.status === "published" && previewOrigin && (
              <a href={`${previewOrigin}${p.slug}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                Ver página <ExternalLink className="size-3.5" />
              </a>
            )}
          </Card>

          <Card className="p-4">
            <button type="button" onClick={() => setSeoOpen((o) => !o)} aria-expanded={seoOpen} className="flex w-full items-center justify-between text-sm font-semibold">
              SEO {seoOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            {seoOpen && (
              <div className="mt-3 grid gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="seo-title" className="text-xs text-muted-foreground">Título SEO</Label>
                  <Input id="seo-title" className="h-8" form="page-form" {...register("seoTitle")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="seo-description" className="text-xs text-muted-foreground">Descripción SEO</Label>
                  <Textarea id="seo-description" rows={3} form="page-form" {...register("seoDescription")} />
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-sm font-semibold">Revisiones</div>
            {revisions.isLoading && <Skeleton className="h-4 w-32" />}
            {revisions.data && revisions.data.length === 0 && <p className="text-sm text-muted-foreground">Sin revisiones.</p>}
            <ul className="divide-y">
              {revisions.data?.map((r) => (
                <li key={r.versionNo} className="flex items-center justify-between py-1.5 text-sm">
                  <span>v{r.versionNo} · {r.title}{r.isPublished && <em className="text-success-ink"> (publicada)</em>}</span>
                  <button type="button" onClick={() => restore.mutate(r.versionNo)} disabled={restore.isPending} className="text-xs text-primary hover:underline">Restaurar</button>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

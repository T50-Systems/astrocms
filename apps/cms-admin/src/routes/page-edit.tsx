import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { cms } from "../lib.ts";
import { Button, ErrorBox, Field, inputStyle, Loading, Page } from "../ui.tsx";

const routeApi = getRouteApi("/pages/$pageId");

interface EditForm {
  title: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
}

export function EditPage() {
  const { pageId } = routeApi.useParams();
  const qc = useQueryClient();

  const page = useQuery({ queryKey: ["page", pageId], queryFn: () => cms.pages.get(pageId) });
  const revisions = useQuery({
    queryKey: ["revisions", pageId],
    queryFn: () => cms.pages.revisions(pageId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["page", pageId] });
    qc.invalidateQueries({ queryKey: ["revisions", pageId] });
    qc.invalidateQueries({ queryKey: ["pages"] });
  };

  const save = useMutation({
    mutationFn: (v: EditForm) =>
      cms.pages.update(pageId, {
        title: v.title,
        data: { body: v.body },
        seo: {
          ...(v.seoTitle.trim() ? { title: v.seoTitle.trim() } : {}),
          ...(v.seoDescription.trim() ? { description: v.seoDescription.trim() } : {}),
        },
      }),
    onSuccess: invalidate,
  });
  const publish = useMutation({ mutationFn: () => cms.pages.publish(pageId), onSuccess: invalidate });
  const unpublish = useMutation({ mutationFn: () => cms.pages.unpublish(pageId), onSuccess: invalidate });
  const restore = useMutation({
    mutationFn: (versionNo: number) => cms.pages.restore(pageId, versionNo),
    onSuccess: invalidate,
  });

  const { register, handleSubmit } = useForm<EditForm>({
    values: {
      title: page.data?.title ?? "",
      body: typeof page.data?.data?.body === "string" ? page.data.data.body : "",
      seoTitle: page.data?.seo.title ?? "",
      seoDescription: page.data?.seo.description ?? "",
    },
  });

  if (page.isLoading) return <Page><Loading /></Page>;
  if (page.isError || !page.data) return <Page><ErrorBox error={page.error ?? new Error("No encontrada")} /></Page>;
  const p = page.data;

  return (
    <Page>
      <Link to="/">← Páginas</Link>
      <h1>Editar: {p.title}</h1>
      <p style={{ color: "#666", fontSize: "0.85rem" }}>
        {p.slug} · estado <strong>{p.status}</strong> · versión {p.currentVersionNo}
      </p>

      {(save.isError || publish.isError) && <ErrorBox error={save.error ?? publish.error} />}

      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
        <Field label="Título" htmlFor="title"><input id="title" style={inputStyle} {...register("title")} /></Field>
        <Field label="Contenido" htmlFor="body">
          <textarea id="body" rows={5} style={inputStyle} {...register("body")} />
        </Field>
        <Field label="SEO title" htmlFor="seo-title"><input id="seo-title" style={inputStyle} {...register("seoTitle")} /></Field>
        <Field label="SEO description" htmlFor="seo-description">
          <textarea id="seo-description" rows={3} style={inputStyle} {...register("seoDescription")} />
        </Field>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Guardando…" : "Guardar borrador"}</Button>
          {p.status === "published" ? (
            <Button ghost type="button" onClick={() => unpublish.mutate()}>Despublicar</Button>
          ) : (
            <Button type="button" onClick={() => publish.mutate()}>Publicar</Button>
          )}
        </div>
      </form>

      <h2 style={{ marginTop: "2rem", fontSize: "1.1rem" }}>Revisiones</h2>
      {revisions.isLoading && <Loading />}
      <ul style={{ paddingLeft: "1rem" }}>
        {revisions.data?.map((r) => (
          <li key={r.versionNo} style={{ marginBottom: "0.3rem" }}>
            v{r.versionNo} — {r.title} {r.isPublished && <em>(publicada)</em>}{" "}
            <button type="button" onClick={() => restore.mutate(r.versionNo)} style={{ fontSize: "0.8rem" }}>
              restaurar
            </button>
          </li>
        ))}
      </ul>
    </Page>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import type { CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { cms } from "../lib.ts";
import { Button, ErrorBox, Loading, Page } from "../ui.tsx";

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

const sidebarCard: CSSProperties = {
  background: "#fff",
  border: "1px solid #dcdcde",
  borderRadius: 8,
  padding: "0.9rem 1rem",
  marginBottom: "0.8rem",
};
const rowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.35rem 0", fontSize: "0.86rem" };
const rowLabel: CSSProperties = { color: "#646970" };
const sidebarLabel: CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#646970", margin: "0.6rem 0 0.25rem" };
const sidebarInput: CSSProperties = { width: "100%", padding: "0.4rem 0.55rem", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.85rem", boxSizing: "border-box" };

function StatusBadge({ status }: { status: string }) {
  const published = status === "published";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: "0.8rem",
        fontWeight: 600,
        color: published ? "#0a6b2e" : "#8a6d00",
      }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: published ? "#00a32a" : "#dba617" }} />
      {published ? "Publicada" : "Borrador"}
    </span>
  );
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

  const save = useMutation({
    mutationFn: (v: EditForm) =>
      cms.pages.update(pageId, {
        title: v.title,
        data: { body: v.body },
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
  const restore = useMutation({
    mutationFn: (versionNo: number) => cms.pages.restore(pageId, versionNo),
    onSuccess: invalidate,
  });

  const { register, handleSubmit } = useForm<EditForm>({
    values: {
      title: page.data?.title ?? "",
      body: typeof page.data?.data?.body === "string" ? page.data.data.body : "",
      slug: page.data?.slug ?? "",
      seoTitle: page.data?.seo.title ?? "",
      seoDescription: page.data?.seo.description ?? "",
    },
  });

  if (page.isLoading) return <Page><Loading /></Page>;
  if (page.isError || !page.data) return <Page><ErrorBox error={page.error ?? new Error("No encontrada")} /></Page>;
  const p = page.data;

  const saveThenPublish = handleSubmit(async (v) => {
    await save.mutateAsync(v);
    await publish.mutateAsync();
  });
  const busy = save.isPending || publish.isPending || unpublish.isPending;

  return (
    <Page wide>
      {/* Barra de acciones */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
        <Link to="/" style={{ color: "#2271b1" }}>← Páginas</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <StatusBadge status={p.status} />
          <Button ghost type="submit" form="page-form" disabled={busy}>
            {save.isPending ? "Guardando…" : "Guardar borrador"}
          </Button>
          {p.status === "published" ? (
            <Button type="button" onClick={() => unpublish.mutate()} disabled={busy}>Despublicar</Button>
          ) : (
            <Button type="button" onClick={() => saveThenPublish()} disabled={busy}>
              {publish.isPending ? "Publicando…" : "Publicar"}
            </Button>
          )}
        </div>
      </div>

      {(save.isError || publish.isError || unpublish.isError) && (
        <ErrorBox error={save.error ?? publish.error ?? unpublish.error} />
      )}

      {/* Dos columnas: contenido + ajustes */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: "1.5rem", alignItems: "start" }}>
        <form id="page-form" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
          <input
            aria-label="Título"
            placeholder="Añade un título"
            style={{ width: "100%", border: 0, outline: 0, background: "transparent", fontSize: "2rem", fontWeight: 700, padding: "0.2rem 0", marginBottom: "1rem", boxSizing: "border-box" }}
            {...register("title")}
          />
          <textarea
            aria-label="Contenido"
            placeholder="Escribe el contenido de la página…"
            rows={16}
            style={{ width: "100%", border: "1px solid #dcdcde", borderRadius: 8, padding: "1rem", fontSize: "1rem", lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box", background: "#fff", minHeight: "24rem" }}
            {...register("body")}
          />
        </form>

        <aside>
          <div style={sidebarCard}>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.4rem" }}>Página</div>
            <div style={rowStyle}><span style={rowLabel}>Estado</span><StatusBadge status={p.status} /></div>
            <div style={rowStyle}><span style={rowLabel}>Guardada</span><span>{fmtDate(p.updatedAt)}</span></div>
            <div style={rowStyle}><span style={rowLabel}>Versión</span><span>{p.currentVersionNo}</span></div>
            <div style={rowStyle}><span style={rowLabel}>Autor</span><span>{p.authorName ?? "—"}</span></div>

            <label htmlFor="slug" style={sidebarLabel}>ID en URL</label>
            <input id="slug" style={sidebarInput} form="page-form" {...register("slug")} />

            {p.status === "published" && previewOrigin && (
              <a
                href={`${previewOrigin}${p.slug}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", marginTop: "0.7rem", color: "#2271b1", fontSize: "0.85rem" }}
              >
                Ver página ↗
              </a>
            )}
          </div>

          <div style={sidebarCard}>
            <button
              type="button"
              onClick={() => setSeoOpen((o) => !o)}
              aria-expanded={seoOpen}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", border: 0, background: "transparent", padding: 0, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem" }}
            >
              SEO <span aria-hidden>{seoOpen ? "▲" : "▼"}</span>
            </button>
            {seoOpen && (
              <div style={{ marginTop: "0.5rem" }}>
                <label htmlFor="seo-title" style={sidebarLabel}>Título SEO</label>
                <input id="seo-title" style={sidebarInput} form="page-form" {...register("seoTitle")} />
                <label htmlFor="seo-description" style={sidebarLabel}>Descripción SEO</label>
                <textarea id="seo-description" rows={3} style={sidebarInput} form="page-form" {...register("seoDescription")} />
              </div>
            )}
          </div>

          <div style={sidebarCard}>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.5rem" }}>Revisiones</div>
            {revisions.isLoading && <Loading />}
            {revisions.data && revisions.data.length === 0 && <p style={{ color: "#646970", fontSize: "0.85rem", margin: 0 }}>Sin revisiones.</p>}
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {revisions.data?.map((r) => (
                <li key={r.versionNo} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0", fontSize: "0.82rem", borderTop: r.versionNo === revisions.data[0]?.versionNo ? "none" : "1px solid #f0f0f1" }}>
                  <span>
                    v{r.versionNo} · {r.title}
                    {r.isPublished && <em style={{ color: "#0a6b2e" }}> (publicada)</em>}
                  </span>
                  <button
                    type="button"
                    onClick={() => restore.mutate(r.versionNo)}
                    disabled={restore.isPending}
                    style={{ border: 0, background: "transparent", color: "#2271b1", cursor: "pointer", fontSize: "0.82rem" }}
                  >
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </Page>
  );
}

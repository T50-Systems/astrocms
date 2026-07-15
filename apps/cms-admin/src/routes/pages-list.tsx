import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FileText, LayoutTemplate, Search, SearchX } from "lucide-react";
import type { Entry, EntryStatus } from "@astrocms/contracts";
import { cms } from "../lib.ts";
import { useSession } from "../auth.tsx";
import { PageContainer } from "@/components/page-container.tsx";
import { Alert } from "@/components/ui/alert.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { PAGE_TEMPLATES, type PageTemplate } from "@/lib/page-templates.ts";
import { cn } from "@/lib/utils.ts";

const dateFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });
const previewOrigin = import.meta.env.VITE_PREVIEW_ORIGIN ?? "";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function PagesListPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: session, isLoading: sessionLoading } = useSession();
  const [status, setStatus] = useState<EntryStatus | undefined>();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<"" | "published" | "draft">("");
  const [templatesOpen, setTemplatesOpen] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !session) nav({ to: "/login" });
  }, [session, sessionLoading, nav]);

  const pages = useQuery({
    queryKey: ["pages", { status, search }],
    queryFn: () => cms.pages.list({ pageSize: 50, ...(status ? { status } : {}), ...(search ? { search } : {}) }),
    enabled: Boolean(session),
    // Al cambiar filtro/búsqueda se sigue mostrando la lista anterior mientras
    // llega la nueva (sin re-skeleton); isPlaceholderData permite atenuarla.
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({ queryKey: ["pages-counts"], queryFn: () => cms.pages.counts(), enabled: Boolean(session) });

  const pageIds = useMemo(() => pages.data?.data.map((p) => p.id) ?? [], [pages.data]);
  const allVisibleSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const invalidateLists = () =>
    Promise.all([qc.invalidateQueries({ queryKey: ["pages"] }), qc.invalidateQueries({ queryKey: ["pages-counts"] })]);

  const removeSelected = useMutation({
    mutationFn: async (ids: string[]) => { await Promise.all(ids.map((id) => cms.pages.remove(id))); },
    onSuccess: async () => { setSelected(new Set()); setBulkAction(""); await invalidateLists(); },
  });
  const removeOne = useMutation({ mutationFn: (id: string) => cms.pages.remove(id), onSuccess: invalidateLists });
  const duplicate = useMutation({
    mutationFn: (page: Entry) => cms.pages.create({ contentTypeKey: page.contentTypeKey, title: `${page.title} (copia)`, editorType: page.editorType, data: page.data }),
    onSuccess: invalidateLists,
  });
  const bulkUpdate = useMutation({
    mutationFn: async ({ ids, target }: { ids: string[]; target: "published" | "draft" }) => {
      await Promise.all(ids.map((id) => (target === "published" ? cms.pages.publish(id) : cms.pages.unpublish(id))));
    },
    onSuccess: async () => { setSelected(new Set()); setBulkAction(""); setBulkEditing(false); setBulkStatus(""); await invalidateLists(); },
  });
  const createVisual = useMutation({
    mutationFn: () =>
      cms.pages.create({ contentTypeKey: "page", title: "Página sin título", editorType: "builder", data: {} }),
    onSuccess: (entry) => nav({ to: "/pages/$pageId/builder", params: { pageId: entry.id } }),
  });
  const createFromTemplate = useMutation({
    mutationFn: async (template: PageTemplate) => {
      const entry = await cms.pages.create({ contentTypeKey: "page", title: template.defaultTitle, editorType: "builder", data: {} });
      if (template.id !== "blank" && entry.builderDocumentId) {
        const doc = await cms.builder.getDocument(entry.builderDocumentId);
        await cms.builder.saveDocument(entry.builderDocumentId, { ...doc, root: template.buildRoot() });
      }
      return entry;
    },
    onSuccess: async (entry) => {
      await invalidateLists();
      setTemplatesOpen(false);
      nav({ to: "/pages/$pageId/builder", params: { pageId: entry.id } });
    },
  });

  if (sessionLoading || !session)
    return (
      <PageContainer>
        <PageHeaderSkeleton actions={1} />
        <TableSkeleton cols={4} />
      </PageContainer>
    );

  const submitSearch = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSearch(searchInput.trim()); setSelected(new Set()); };
  const toggleAll = () => setSelected((cur) => (pageIds.length > 0 && pageIds.every((id) => cur.has(id)) ? new Set() : new Set(pageIds)));
  const toggleOne = (id: string) => setSelected((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const applyBulk = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (bulkAction === "delete") { if (window.confirm(`¿Eliminar ${ids.length} página(s) seleccionada(s)?`)) removeSelected.mutate(ids); }
    else if (bulkAction === "edit") setBulkEditing(true);
  };
  const applyBulkEdit = () => {
    const ids = Array.from(selected);
    if (ids.length === 0 || (bulkStatus !== "published" && bulkStatus !== "draft")) return;
    bulkUpdate.mutate({ ids, target: bulkStatus });
  };
  const setFilter = (nextStatus: EntryStatus | undefined) => { setStatus(nextStatus); setSelected(new Set()); };
  const errors = [pages.error, counts.error, removeSelected.error, bulkUpdate.error, removeOne.error, duplicate.error, createVisual.error].filter(Boolean) as Error[];

  return (
    <PageContainer>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-page-title font-semibold tracking-tight">Páginas</h1>
          <Button size="sm" onClick={() => nav({ to: "/pages/new" })}>Añadir nueva</Button>
          <Button size="sm" variant="outline" onClick={() => createVisual.mutate()} loading={createVisual.isPending}>
            <LayoutTemplate className="size-4" /> Página visual
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTemplatesOpen(true)}>
            <LayoutTemplate className="size-4" /> Plantillas
          </Button>
        </div>
        <form onSubmit={submitSearch} role="search" className="flex items-center gap-2">
          <label htmlFor="page-search" className="sr-only">Buscar páginas</label>
          <Input id="page-search" value={searchInput} onChange={(e) => setSearchInput(e.currentTarget.value)} placeholder="Buscar páginas" className="w-56" />
          <Button type="submit" variant="outline" size="icon" aria-label="Buscar"><Search /></Button>
        </form>
      </div>

      <nav aria-label="Filtros de estado" className="mb-4 flex gap-4 border-b border-border">
        <StatusFilter active={!status} label="Todas" count={counts.data?.all} onClick={() => setFilter(undefined)} />
        <StatusFilter active={status === "published"} label="Publicadas" count={counts.data?.published} onClick={() => setFilter("published")} />
        <StatusFilter active={status === "draft"} label="Borradores" count={counts.data?.draft} onClick={() => setFilter("draft")} />
      </nav>

      <div className="mb-3 flex items-center gap-2">
        <Select value={bulkAction} onValueChange={setBulkAction}>
          <SelectTrigger className="w-48" aria-label="Acciones en lote"><SelectValue placeholder="Acciones en lote" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="edit">Editar</SelectItem>
            <SelectItem value="delete">Eliminar</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={applyBulk} loading={removeSelected.isPending} disabled={!bulkAction || selected.size === 0}>
          {removeSelected.isPending ? "Aplicando…" : "Aplicar"}
        </Button>
        {selected.size > 0 && <span className="text-sm text-muted-foreground">{selected.size} seleccionada(s)</span>}
      </div>

      {bulkEditing && selected.size > 0 && (
        <div className="mb-3 rounded-md border border-primary/20 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm">Edición masiva · {selected.size} página(s)</strong>
            <span className="text-sm">Estado:</span>
            <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as "published" | "draft")}>
              <SelectTrigger className="w-48" aria-label="Cambiar estado"><SelectValue placeholder="— Sin cambios —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Publicar</SelectItem>
                <SelectItem value="draft">Pasar a borrador</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={applyBulkEdit} loading={bulkUpdate.isPending} disabled={!bulkStatus}>{bulkUpdate.isPending ? "Actualizando…" : "Actualizar"}</Button>
            <Button variant="ghost" size="sm" onClick={() => { setBulkEditing(false); setBulkStatus(""); }}>Cancelar</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{pages.data?.data.filter((p) => selected.has(p.id)).map((p) => p.title).join(" · ")}</p>
        </div>
      )}

      {errors.map((e, i) => (
        <Alert key={i} className="mb-3">{e.message}</Alert>
      ))}
      {/* Misma silueta que la tabla real: el swap carga→datos no cambia la forma. */}
      {pages.isLoading && <TableSkeleton cols={4} />}
      {pages.data && pages.data.data.length === 0 && (
        search ? (
          <EmptyState icon={SearchX} title="No hay páginas que coincidan con la búsqueda." />
        ) : (
          <EmptyState
            icon={FileText}
            title="Aún no hay páginas. Crea la primera con Añadir nueva."
            action={
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => nav({ to: "/pages/new" })}>Añadir nueva</Button>
                <Button size="sm" variant="outline" onClick={() => createVisual.mutate()} loading={createVisual.isPending}>
                  <LayoutTemplate className="size-4" /> Página visual
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTemplatesOpen(true)}>
                  <LayoutTemplate className="size-4" /> Plantillas
                </Button>
              </div>
            }
          />
        )
      )}

      {pages.data && pages.data.data.length > 0 && (
        <div className={cn("overflow-x-auto rounded-lg border bg-card shadow-xs transition-opacity duration-150", pages.isPlaceholderData && "opacity-60")}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox aria-label="Seleccionar todas las páginas" checked={allVisibleSelected} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="w-44">Autor</TableHead>
                <TableHead className="w-52">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.data.data.map((page) => (
                <TableRow key={page.id} className="group">
                  <TableCell className="align-top"><Checkbox aria-label={`Seleccionar ${page.title}`} checked={selected.has(page.id)} onCheckedChange={() => toggleOne(page.id)} /></TableCell>
                  <TableCell className="align-top">
                    <Link to="/pages/$pageId" params={{ pageId: page.id }} className="font-medium text-foreground hover:text-primary">{page.title}</Link>
                    <div className="mt-0.5 text-xs text-muted-foreground">{page.slug}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Link to="/pages/$pageId" params={{ pageId: page.id }} className="text-muted-foreground hover:text-foreground">Editar</Link>
                      {page.editorType === "builder" && (
                        <>
                          <span className="text-border">|</span>
                          <Link to="/pages/$pageId/builder" params={{ pageId: page.id }} className="text-muted-foreground hover:text-foreground">Editar visual</Link>
                        </>
                      )}
                      <span className="text-border">|</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => duplicate.mutate(page)} disabled={duplicate.isPending}>Duplicar</button>
                      {page.status === "published" && previewOrigin && (
                        <>
                          <span className="text-border">|</span>
                          <a href={`${previewOrigin}${page.slug}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Ver</a>
                        </>
                      )}
                      <span className="text-border">|</span>
                      <button type="button" className="text-muted-foreground hover:text-destructive-ink" disabled={removeOne.isPending}
                        onClick={() => { if (window.confirm(`¿Eliminar "${page.title}"?`)) removeOne.mutate(page.id); }}>Eliminar</button>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm">{page.authorName ?? "—"}</TableCell>
                  <TableCell className="align-top">
                    <div className="text-sm tabular-nums">{formatDate(page.updatedAt)}</div>
                    <Badge variant={page.status === "published" ? "success" : "warning"} className="mt-1">{page.status === "published" ? "Publicada" : "Borrador"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Elige una plantilla</DialogTitle>
            <DialogDescription>Crea una página visual con contenido inicial que podrás editar después.</DialogDescription>
          </DialogHeader>
          {createFromTemplate.error && <Alert>{createFromTemplate.error.message}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            {PAGE_TEMPLATES.map((template) => (
              <Button
                key={template.id}
                type="button"
                variant="outline"
                className="h-auto items-start justify-start whitespace-normal p-4 text-left"
                disabled={createFromTemplate.isPending}
                onClick={() => createFromTemplate.mutate(template)}
              >
                <span>
                  <span className="block font-semibold">{template.name}</span>
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">{template.description}</span>
                </span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function StatusFilter({ active, label, count, onClick }: { active: boolean; label: string; count: number | undefined; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "-mb-px border-b-2 border-transparent pb-2 text-sm text-muted-foreground hover:text-foreground",
        active && "border-primary font-medium text-foreground",
      )}
    >
      {label} <span className="text-muted-foreground tabular-nums">({count ?? 0})</span>
    </button>
  );
}

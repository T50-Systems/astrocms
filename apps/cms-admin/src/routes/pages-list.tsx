import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FileText, Search, SearchX } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
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

  useEffect(() => {
    if (!sessionLoading && !session) nav({ to: "/login" });
  }, [session, sessionLoading, nav]);

  const pages = useQuery({
    queryKey: ["pages", { status, search }],
    queryFn: () => cms.pages.list({ pageSize: 50, ...(status ? { status } : {}), ...(search ? { search } : {}) }),
    enabled: Boolean(session),
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

  if (sessionLoading || !session)
    return (
      <PageContainer>
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageContainer>
    );

  const submitSearch = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSearch(searchInput.trim()); setSelected(new Set()); };
  const toggleAll = () => setSelected((cur) => (pageIds.length > 0 && pageIds.every((id) => cur.has(id)) ? new Set() : new Set(pageIds)));
  const toggleOne = (id: string) => setSelected((cur) => { const next = new Set(cur); next.has(id) ? next.delete(id) : next.add(id); return next; });
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
  const errors = [pages.error, counts.error, removeSelected.error, bulkUpdate.error, removeOne.error, duplicate.error].filter(Boolean) as Error[];

  return (
    <PageContainer>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Páginas</h1>
          <Button size="sm" onClick={() => nav({ to: "/pages/new" })}>Añadir nueva</Button>
        </div>
        <form onSubmit={submitSearch} role="search" className="flex items-center gap-2">
          <label htmlFor="page-search" className="sr-only">Buscar páginas</label>
          <Input id="page-search" value={searchInput} onChange={(e) => setSearchInput(e.currentTarget.value)} placeholder="Buscar páginas" className="w-56" />
          <Button type="submit" variant="outline" size="icon"><Search /></Button>
        </form>
      </div>

      <nav aria-label="Filtros de estado" className="mb-4 flex items-center gap-2 text-sm">
        <StatusFilter active={!status} label="Todas" count={counts.data?.all} onClick={() => setFilter(undefined)} />
        <span className="text-muted-foreground">·</span>
        <StatusFilter active={status === "published"} label="Publicadas" count={counts.data?.published} onClick={() => setFilter("published")} />
        <span className="text-muted-foreground">·</span>
        <StatusFilter active={status === "draft"} label="Borradores" count={counts.data?.draft} onClick={() => setFilter("draft")} />
      </nav>

      <div className="mb-3 flex items-center gap-2">
        <Select value={bulkAction} onValueChange={setBulkAction}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Acciones en lote" /></SelectTrigger>
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
              <SelectTrigger className="w-48"><SelectValue placeholder="— Sin cambios —" /></SelectTrigger>
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
      {pages.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      {pages.data && pages.data.data.length === 0 && (
        search ? (
          <EmptyState icon={SearchX} title="No hay páginas que coincidan con la búsqueda." />
        ) : (
          <EmptyState
            icon={FileText}
            title="Aún no hay páginas. Crea la primera con Añadir nueva."
            action={<Button size="sm" onClick={() => nav({ to: "/pages/new" })}>Añadir nueva</Button>}
          />
        )
      )}

      {pages.data && pages.data.data.length > 0 && (
        <div className="rounded-lg border bg-card">
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
                    <Link to="/pages/$pageId" params={{ pageId: page.id }} className="font-semibold text-primary hover:underline">{page.title}</Link>
                    <div className="mt-0.5 text-xs text-muted-foreground">{page.slug}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Link to="/pages/$pageId" params={{ pageId: page.id }} className="text-primary hover:underline">Editar</Link>
                      {page.editorType === "builder" && (
                        <>
                          <span className="text-border">|</span>
                          <Link to="/pages/$pageId/builder" params={{ pageId: page.id }} className="text-primary hover:underline">Editar visual</Link>
                        </>
                      )}
                      <span className="text-border">|</span>
                      <button type="button" className="text-primary hover:underline" onClick={() => duplicate.mutate(page)} disabled={duplicate.isPending}>Duplicar</button>
                      {page.status === "published" && previewOrigin && (
                        <>
                          <span className="text-border">|</span>
                          <a href={`${previewOrigin}${page.slug}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">Ver</a>
                        </>
                      )}
                      <span className="text-border">|</span>
                      <button type="button" className="text-destructive hover:underline" disabled={removeOne.isPending}
                        onClick={() => { if (window.confirm(`¿Eliminar "${page.title}"?`)) removeOne.mutate(page.id); }}>Eliminar</button>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm">{page.authorName ?? "—"}</TableCell>
                  <TableCell className="align-top">
                    <div className="text-sm">{formatDate(page.updatedAt)}</div>
                    <Badge variant={page.status === "published" ? "success" : "warning"} className="mt-1">{page.status === "published" ? "Publicada" : "Borrador"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}

function StatusFilter({ active, label, count, onClick }: { active: boolean; label: string; count: number | undefined; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("text-primary hover:underline", active && "font-bold")}>
      {label} ({count ?? 0})
    </button>
  );
}

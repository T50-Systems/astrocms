import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Folder, FolderPlus, Image, LayoutGrid, Library, List, SearchX } from "lucide-react";
import type { MediaAsset } from "@astrocms/contracts";
import { cms } from "../lib.ts";
import { PageContainer } from "@/components/page-container.tsx";
import { Alert, errMsg } from "@/components/ui/alert.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { cn } from "@/lib/utils.ts";

const ALL = "__all__";
const NONE = "__none__"; // "sin carpeta" como destino al mover

function thumbUrl(asset: MediaAsset): string {
  return asset.variants.find((v) => v.kind === "thumb")?.url ?? asset.url;
}
function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
const dateFmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });
function fmtDate(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : dateFmt.format(d);
}

export function MediaPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"grid" | "list">(() => (localStorage.getItem("media-view") === "list" ? "list" : "grid"));
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [folder, setFolder] = useState<string>(ALL); // ALL o nombre de carpeta
  const [localFolders, setLocalFolders] = useState<string[]>([]); // carpetas recién creadas (aún vacías)
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkFolder, setBulkFolder] = useState<string>(NONE); // destino para "mover" en lote
  const inputRef = useRef<HTMLInputElement>(null);

  const chooseView = (v: "grid" | "list") => {
    setView(v);
    localStorage.setItem("media-view", v);
  };

  const media = useQuery({
    queryKey: ["media", term, folder],
    queryFn: () =>
      cms.media.list({
        ...(term ? { search: term } : {}),
        ...(folder !== ALL ? { folder } : {}),
        page: 1,
        pageSize: 60,
      }),
  });
  const foldersQ = useQuery({ queryKey: ["media-folders"], queryFn: () => cms.media.folders() });

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["media"] }),
      qc.invalidateQueries({ queryKey: ["media-folders"] }),
    ]);

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const target = folder !== ALL ? folder : undefined;
      for (const file of files) await cms.media.upload(file, target ? { folder: target } : undefined);
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => cms.media.remove(id), onSuccess: invalidate });
  const move = useMutation({
    mutationFn: ({ id, folder: f }: { id: string; folder: string | null }) => cms.media.update(id, { folder: f }),
    onSuccess: invalidate,
  });
  const clearSelection = () => setSelected(new Set());
  const bulkMove = useMutation({
    mutationFn: async ({ ids, folder: f }: { ids: string[]; folder: string | null }) => {
      await Promise.all(ids.map((id) => cms.media.update(id, { folder: f })));
    },
    onSuccess: () => { invalidate(); clearSelection(); },
  });
  const bulkRemove = useMutation({
    mutationFn: async (ids: string[]) => { await Promise.all(ids.map((id) => cms.media.remove(id))); },
    onSuccess: () => { invalidate(); clearSelection(); },
  });

  // Carpetas conocidas = las del servidor + las creadas localmente (aún sin archivos).
  const folders = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of foldersQ.data ?? []) map.set(f.name, f.count);
    for (const f of localFolders) if (!map.has(f)) map.set(f, 0);
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [foldersQ.data, localFolders]);
  const folderNames = folders.map((f) => f.name);

  const handleFiles = (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (files.length) upload.mutate(files);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };
  const newFolder = () => {
    const name = window.prompt("Nombre de la nueva carpeta")?.trim();
    if (!name) return;
    if (!folderNames.includes(name)) setLocalFolders((prev) => [...prev, name]);
    setFolder(name); // entra en la carpeta: las subidas irán aquí
    setShowUpload(true);
  };

  const items = media.data?.data ?? [];
  const itemIds = items.map((a) => a.id);
  const allSelected = itemIds.length > 0 && itemIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected((cur) => (itemIds.every((id) => cur.has(id)) ? new Set() : new Set(itemIds)));
  const toggleOne = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const applyBulkMove = () => {
    const ids = [...selected];
    if (ids.length) bulkMove.mutate({ ids, folder: bulkFolder === NONE ? null : bulkFolder });
  };
  const applyBulkDelete = () => {
    const ids = [...selected];
    if (ids.length && window.confirm(`¿Eliminar ${ids.length} archivo(s)?`)) bulkRemove.mutate(ids);
  };
  const bulkBusy = bulkMove.isPending || bulkRemove.isPending;

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-page-title font-semibold tracking-tight">Medios</h1>
        <Button onClick={() => setShowUpload((s) => !s)} aria-expanded={showUpload}>Añadir archivo</Button>
      </div>
      <p className="mt-1 mb-4 text-muted-foreground">Sube y organiza las imágenes de tu sitio.</p>

      {/* Navegación tipo carpeta + área de contenido */}
      <div className="grid grid-cols-[210px_minmax(0,1fr)] items-start gap-5">
        <nav aria-label="Carpetas" className="flex flex-col gap-0.5 rounded-lg border bg-card p-2 shadow-xs">
          <button
            type="button"
            aria-current={folder === ALL}
            onClick={() => setFolder(ALL)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm",
              folder === ALL ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-2 truncate"><Library className="size-4 shrink-0" /> Todos los medios</span>
          </button>
          {folders.map((f) => (
            <button
              key={f.name}
              type="button"
              aria-current={folder === f.name}
              onClick={() => setFolder(f.name)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                folder === f.name ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-2 truncate"><Folder className="size-4 shrink-0" /> {f.name}</span>
              <span className="text-xs tabular-nums opacity-75">{f.count}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={newFolder}
            className="mt-1 flex w-full items-center gap-2 rounded-md border-t px-2.5 pb-1 pt-3 text-left text-sm text-primary hover:underline"
          >
            <FolderPlus className="size-4 shrink-0" /> Nueva carpeta
          </button>
        </nav>

        <div className="min-w-0">
          {/* Zona de subida: sólo visible al pulsar "Añadir archivo" */}
          {showUpload && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "mb-4 rounded-lg border-2 border-dashed p-6 text-center",
                dragOver ? "border-primary bg-primary/5" : "border-border bg-card",
              )}
            >
              <p className="mb-2 text-base">Arrastra archivos aquí para subirlos</p>
              <p className="mb-3 text-muted-foreground">o</p>
              <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              <Button type="button" loading={upload.isPending} onClick={() => inputRef.current?.click()}>
                {upload.isPending ? "Subiendo…" : "Seleccionar archivos"}
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Imágenes JPG, PNG, WebP o GIF.
                {folder !== ALL && <> Se subirán a <strong>{folder}</strong>.</>}
              </p>
            </div>
          )}

          {upload.isError && <Alert className="mb-3">{errMsg(upload.error)}</Alert>}
          {remove.isError && <Alert className="mb-3">{errMsg(remove.error)}</Alert>}
          {move.isError && <Alert className="mb-3">{errMsg(move.error)}</Alert>}
          {(bulkMove.isError || bulkRemove.isError) && (
            <Alert className="mb-3">{errMsg(bulkMove.error ?? bulkRemove.error)}</Alert>
          )}

          {/* Barra de edición masiva (aparece al seleccionar) */}
          {selected.size > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
              <strong className="text-sm">{selected.size} seleccionado(s)</strong>
              <Label htmlFor="bulk-move" className="text-sm font-normal">Mover a:</Label>
              <Select value={bulkFolder} onValueChange={setBulkFolder}>
                <SelectTrigger id="bulk-move" className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— sin carpeta —</SelectItem>
                  {folderNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" onClick={applyBulkMove} loading={bulkMove.isPending} disabled={bulkBusy}>{bulkMove.isPending ? "Moviendo…" : "Mover"}</Button>
              <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={applyBulkDelete} loading={bulkRemove.isPending} disabled={bulkBusy}>
                {bulkRemove.isPending ? "Eliminando…" : "Eliminar"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clearSelection} disabled={bulkBusy}>Deseleccionar</Button>
            </div>
          )}

          {/* Cabecera: carpeta actual + vista + buscar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-lg font-semibold">{folder === ALL ? "Todos los medios" : folder}</h2>
            <div role="group" aria-label="Modo de vista" className="ml-2 flex">
              <Button type="button" size="icon" aria-pressed={view === "list"} title="Vista de lista"
                variant="outline" className={cn("rounded-r-none", view === "list" ? "bg-accent text-foreground" : "text-muted-foreground")} onClick={() => chooseView("list")}>
                <List />
              </Button>
              <Button type="button" size="icon" aria-pressed={view === "grid"} title="Vista de cuadrícula"
                variant="outline" className={cn("-ml-px rounded-l-none", view === "grid" ? "bg-accent text-foreground" : "text-muted-foreground")} onClick={() => chooseView("grid")}>
                <LayoutGrid />
              </Button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setTerm(search.trim()); }} className="ml-auto flex items-center gap-2">
              <label htmlFor="media-search" className="sr-only">Buscar medios</label>
              <Input id="media-search" placeholder="Buscar medios" value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
              <Button variant="outline" type="submit">Buscar</Button>
            </form>
          </div>

          {/* Misma altura que EmptyState (min-h-56): sin salto al resolver la query. */}
          {media.isLoading && <Skeleton className="h-56 w-full rounded-lg" />}
          {media.isError && <Alert>{errMsg(media.error)}</Alert>}
          {media.data && items.length === 0 && (
            term ? (
              <EmptyState icon={SearchX} title="No hay medios que coincidan con la búsqueda." />
            ) : folder !== ALL ? (
              <EmptyState icon={Image} title="Esta carpeta está vacía." />
            ) : (
              <EmptyState icon={Image} title="No hay medios todavía. Sube el primero con Añadir archivo." />
            )
          )}

          {media.data && items.length > 0 && view === "grid" && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {items.map((asset) => (
                <figure key={asset.id} className={cn("m-0 overflow-hidden rounded-lg border bg-card", selected.has(asset.id) && "border-primary ring-1 ring-primary")}>
                  <div className="relative aspect-square bg-muted">
                    <img src={thumbUrl(asset)} alt={asset.alt ?? asset.filename} className="block size-full object-cover" />
                    <Checkbox
                      className="absolute left-1.5 top-1.5 bg-background"
                      aria-label={`Seleccionar ${asset.filename}`}
                      checked={selected.has(asset.id)}
                      onCheckedChange={() => toggleOne(asset.id)}
                    />
                    <button
                      type="button"
                      aria-label={`Eliminar ${asset.filename}`}
                      disabled={remove.isPending}
                      onClick={() => { if (window.confirm(`¿Eliminar "${asset.filename}"?`)) remove.mutate(asset.id); }}
                      className="absolute right-1 top-1 cursor-pointer rounded bg-black/60 px-1.5 text-white"
                    >
                      ×
                    </button>
                    {asset.folder && folder === ALL && (
                      <Badge variant="secondary" className="absolute bottom-1 left-1"><Folder className="size-3" /> {asset.folder}</Badge>
                    )}
                  </div>
                  <figcaption className="p-2 text-xs">
                    <div className="truncate" title={asset.filename}>{asset.filename}</div>
                    <div className="text-muted-foreground">{humanBytes(asset.bytes)}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {media.data && items.length > 0 && view === "list" && (
            <div className="rounded-lg border bg-card shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox aria-label="Seleccionar todos" checked={allSelected} onCheckedChange={() => toggleAll()} />
                    </TableHead>
                    <TableHead>Archivo</TableHead>
                    <TableHead className="w-44">Carpeta</TableHead>
                    <TableHead className="w-24">Tamaño</TableHead>
                    <TableHead className="w-32">Fecha</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <Checkbox aria-label={`Seleccionar ${asset.filename}`} checked={selected.has(asset.id)} onCheckedChange={() => toggleOne(asset.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <img src={thumbUrl(asset)} alt={asset.alt ?? asset.filename} className="size-10 shrink-0 rounded bg-muted object-cover" />
                          <span className="inline-block max-w-72 truncate align-middle" title={asset.filename}>{asset.filename}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <label htmlFor={`move-${asset.id}`} className="sr-only">Mover {asset.filename} de carpeta</label>
                        <Select value={asset.folder ?? NONE} disabled={move.isPending}
                          onValueChange={(v) => move.mutate({ id: asset.id, folder: v === NONE ? null : v })}>
                          <SelectTrigger id={`move-${asset.id}`} className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>— sin carpeta —</SelectItem>
                            {folderNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{humanBytes(asset.bytes)}</TableCell>
                      <TableCell className="text-sm tabular-nums">{fmtDate(asset.createdAt)}</TableCell>
                      <TableCell>
                        <button type="button" disabled={remove.isPending}
                          onClick={() => { if (window.confirm(`¿Eliminar "${asset.filename}"?`)) remove.mutate(asset.id); }}
                          className="text-sm text-destructive hover:underline">Eliminar</button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

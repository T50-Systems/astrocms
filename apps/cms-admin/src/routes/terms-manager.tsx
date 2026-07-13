import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Tag } from "lucide-react";
import type { Term } from "@astrocms/contracts";
import { cms } from "../lib.ts";
import { PageContainer } from "@/components/page-container.tsx";
import { Alert, errMsg } from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { TableSkeleton } from "@/components/skeletons.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";

type TermRow = Term & { depth: number };

function flattenTerms(terms: Term[], depth = 0): TermRow[] {
  return terms.flatMap((term) => [{ ...term, depth }, ...flattenTerms(term.children ?? [], depth + 1)]);
}

interface BulkItem {
  name: string;
  description?: string;
}

/** Parsea el JSON de alta múltiple: array de objetos con al menos `name`. */
function parseBulk(text: string): BulkItem[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('El JSON debe ser un array, p.ej. [{ "name": "Noticias" }]');
  return parsed.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) throw new Error(`El elemento ${i + 1} no es un objeto`);
    const obj = raw as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    if (!name) throw new Error(`El elemento ${i + 1} no tiene "name"`);
    const description = typeof obj.description === "string" ? obj.description.trim() : undefined;
    return { name, ...(description ? { description } : {}) };
  });
}

const BULK_PLACEHOLDER = `[
  { "name": "Noticias", "description": "Novedades del sitio" },
  { "name": "Guías" }
]`;

const NO_PARENT = "__none__";

export interface TermsManagerProps {
  taxonomyKey: string;
  title: string;
  subtitle: string;
  singular: string; // "categoría" | "etiqueta"
  plural: string; // "categorías" | "etiquetas"
  hierarchical: boolean; // muestra "superior" (padre)
}

/** Gestor de términos reutilizable (Categorías, Etiquetas): tabla + alta + edición/borrado en lote. */
export function TermsManager({ taxonomyKey, title, subtitle, singular, plural, hierarchical }: TermsManagerProps) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["taxonomy", taxonomyKey], queryFn: () => cms.taxonomies.get(taxonomyKey) });
  const rows = useMemo(() => flattenTerms(query.data?.terms ?? []), [query.data]);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"one" | "bulk">("one");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [bulkText, setBulkText] = useState("");

  // Selección + edición en lote.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [editing, setEditing] = useState<Record<string, { name: string; description: string }>>({});
  const editingIds = Object.keys(editing);

  const refresh = () => qc.invalidateQueries({ queryKey: ["taxonomy", taxonomyKey] });
  const resetForm = () => {
    setName("");
    setDescription("");
    setParentId("");
  };

  const addOne = useMutation({
    mutationFn: (_vars: { closeAfter: boolean }) =>
      cms.taxonomies.upsertTerm(taxonomyKey, {
        name: name.trim(),
        description: description.trim(),
        ...(hierarchical && parentId ? { parentId } : {}),
      }),
    onSuccess: (_data, vars) => {
      refresh();
      resetForm();
      if (vars.closeAfter) setOpen(false);
    },
  });

  const addBulk = useMutation({
    mutationFn: async () => {
      const items = parseBulk(bulkText);
      for (const item of items) {
        await cms.taxonomies.upsertTerm(taxonomyKey, { name: item.name, ...(item.description ? { description: item.description } : {}) });
      }
      return items.length;
    },
    onSuccess: () => {
      refresh();
      setBulkText("");
      setOpen(false);
    },
  });

  // Guarda todas las filas en edición a la vez (upsert por slug existente).
  const saveEdits = useMutation({
    mutationFn: async () => {
      const byId = new Map(rows.map((r) => [r.id, r]));
      await Promise.all(
        editingIds.map((id) => {
          const term = byId.get(id);
          const values = editing[id];
          if (!term || !values || !values.name.trim()) return Promise.resolve();
          return cms.taxonomies.upsertTerm(taxonomyKey, {
            slug: term.slug,
            name: values.name.trim(),
            description: values.description.trim(),
            ...(hierarchical && term.parentId ? { parentId: term.parentId } : {}),
          });
        }),
      );
    },
    onSuccess: () => {
      refresh();
      setEditing({});
      setSelected(new Set());
      setBulkAction("");
    },
  });

  const removeTerms = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => cms.taxonomies.deleteTerm(taxonomyKey, id))),
    onSuccess: () => {
      refresh();
      setSelected(new Set());
      setBulkAction("");
    },
  });

  const openModal = () => {
    resetForm();
    setBulkText("");
    setMode("one");
    addOne.reset();
    addBulk.reset();
    setOpen(true);
  };

  const ids = rows.map((r) => r.id);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const toggleAll = () => setSelected((cur) => (ids.every((id) => cur.has(id)) ? new Set() : new Set(ids)));
  const toggleOne = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const startEdit = (targetIds: string[]) => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const next: Record<string, { name: string; description: string }> = { ...editing };
    for (const id of targetIds) {
      const term = byId.get(id);
      if (term) next[id] = { name: term.name, description: term.description ?? "" };
    }
    setEditing(next);
  };
  const updateEdit = (id: string, field: "name" | "description", value: string) =>
    setEditing((cur) => ({ ...cur, [id]: { ...cur[id]!, [field]: value } }));

  const applyBulk = () => {
    const list = [...selected];
    if (list.length === 0) return;
    if (bulkAction === "delete") {
      if (window.confirm(`¿Eliminar ${list.length} ${list.length === 1 ? singular : plural}?`)) removeTerms.mutate(list);
    } else if (bulkAction === "edit") {
      startEdit(list);
    }
  };

  const busy = addOne.isPending || addBulk.isPending;

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-page-title font-semibold tracking-tight">{title}</h1>
        <Button type="button" onClick={openModal}>+ Añadir {singular}</Button>
      </div>
      <p className="mt-1 text-muted-foreground">{subtitle}</p>

      {query.isLoading && <div className="mt-4"><TableSkeleton cols={5} /></div>}
      {query.isError && <Alert className="mt-4">{errMsg(query.error)}</Alert>}
      {(removeTerms.isError || saveEdits.isError) && (
        <Alert className="mt-4">{errMsg(removeTerms.error ?? saveEdits.error)}</Alert>
      )}
      {query.data?.terms.length === 0 && (
        <EmptyState icon={Tag} className="mt-4" title={`Aún no hay ${plural}. Crea la primera con “+ Añadir ${singular}”.`} />
      )}

      {rows.length > 0 && (
        <>
          {/* Barra de acciones en lote (estilo WordPress) */}
          <div className="my-3 flex items-center gap-2">
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger id={`bulk-${taxonomyKey}`} className="w-48" aria-label="Acciones en lote">
                <SelectValue placeholder="Acciones en lote" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="edit">Editar</SelectItem>
                <SelectItem value="delete">Eliminar</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" type="button" onClick={applyBulk} loading={removeTerms.isPending} disabled={!bulkAction || selected.size === 0}>
              {removeTerms.isPending ? "Aplicando…" : "Aplicar"}
            </Button>
            {selected.size > 0 && <span className="text-sm text-muted-foreground">{selected.size} seleccionada(s)</span>}
          </div>

          {/* Barra de guardado cuando hay filas en edición */}
          {editingIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
              <strong className="text-sm">Editando {editingIds.length} {editingIds.length === 1 ? singular : plural}</strong>
              <Button size="sm" type="button" onClick={() => saveEdits.mutate()} loading={saveEdits.isPending}>{saveEdits.isPending ? "Guardando…" : "Guardar cambios"}</Button>
              <Button variant="ghost" size="sm" type="button" onClick={() => setEditing({})} disabled={saveEdits.isPending}>Cancelar</Button>
            </div>
          )}

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox aria-label="Seleccionar todas" checked={allSelected} onCheckedChange={() => toggleAll()} />
                  </TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>ID en URL</TableHead>
                  <TableHead className="w-24">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((term) => {
                  const edit = editing[term.id];
                  return (
                    <TableRow key={term.id} className="group">
                      <TableCell className="align-top">
                        <Checkbox aria-label={`Seleccionar ${term.name}`} checked={selected.has(term.id)} onCheckedChange={() => toggleOne(term.id)} />
                      </TableCell>
                      <TableCell className="align-top font-semibold">
                        {edit ? (
                          <Input className="h-8 text-sm" aria-label={`Nombre de ${term.name}`} value={edit.name} onChange={(e) => updateEdit(term.id, "name", e.target.value)} />
                        ) : (
                          <>
                            {"— ".repeat(term.depth)}
                            {term.name}
                            <div className="mt-1 flex items-center gap-1.5 text-xs font-normal opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                              <button type="button" className="text-primary hover:underline" onClick={() => startEdit([term.id])}>Edición rápida</button>
                              <span className="text-border">|</span>
                              <button type="button" className="text-destructive hover:underline" onClick={() => { if (window.confirm(`¿Eliminar "${term.name}"?`)) removeTerms.mutate([term.id]); }}>Eliminar</button>
                            </div>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-muted-foreground">
                        {edit ? (
                          <Input className="h-8 text-sm" aria-label={`Descripción de ${term.name}`} value={edit.description} onChange={(e) => updateEdit(term.id, "description", e.target.value)} />
                        ) : (
                          term.description ?? ""
                        )}
                      </TableCell>
                      <TableCell className="align-top text-muted-foreground">{term.slug}</TableCell>
                      <TableCell className="align-top">{term.count}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Añadir {singular}</DialogTitle>
            <DialogDescription>Crea una {singular} nueva, o varias a la vez pegando un JSON.</DialogDescription>
          </DialogHeader>

          <div role="group" aria-label="Modo de alta" className="flex gap-1.5">
            <Button variant={mode === "one" ? "default" : "outline"} size="sm" type="button" aria-pressed={mode === "one"} onClick={() => setMode("one")}>Una</Button>
            <Button variant={mode === "bulk" ? "default" : "outline"} size="sm" type="button" aria-pressed={mode === "bulk"} onClick={() => setMode("bulk")}>Varias (JSON)</Button>
          </div>

          {(addOne.isError || addBulk.isError) && (
            <Alert>{errMsg(addOne.error ?? addBulk.error)}</Alert>
          )}

          {mode === "one" ? (
            <div className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="term-name">Nombre</Label>
                <Input id="term-name" placeholder="Ej. Noticias" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="term-desc">Descripción</Label>
                <Textarea id="term-desc" rows={3} placeholder={`Describe cómo se usa esta ${singular}.`} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {hierarchical && (
                <div className="space-y-1.5">
                  <Label htmlFor="term-parent">{`${title.slice(0, -1)} superior (opcional)`}</Label>
                  <Select value={parentId || NO_PARENT} onValueChange={(v) => setParentId(v === NO_PARENT ? "" : v)}>
                    <SelectTrigger id="term-parent"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PARENT}>Ninguna</SelectItem>
                      {rows.map((term) => (
                        <SelectItem key={term.id} value={term.id}>
                          {"— ".repeat(term.depth)}
                          {term.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="term-bulk">{`Pega un array JSON de ${plural}`}</Label>
              <Textarea id="term-bulk" rows={9} placeholder={BULK_PLACEHOLDER} className="font-mono text-sm" value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
            </div>
          )}

          <DialogFooter>
            {mode === "one" ? (
              <>
                <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button variant="outline" type="button" disabled={busy || !name.trim()} onClick={() => addOne.mutate({ closeAfter: false })}>
                  Añadir y otra
                </Button>
                <Button type="button" loading={addOne.isPending} disabled={busy || !name.trim()} onClick={() => addOne.mutate({ closeAfter: true })}>
                  {addOne.isPending ? "Guardando…" : "Añadir"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="button" loading={addBulk.isPending} disabled={busy || !bulkText.trim()} onClick={() => addBulk.mutate()}>
                  {addBulk.isPending ? "Añadiendo…" : "Añadir todas"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

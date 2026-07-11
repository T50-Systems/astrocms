import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Term } from "@astrocms/contracts";
import { cms } from "../lib.ts";
import { Button, Empty, ErrorBox, Field, inputStyle, Loading, Page } from "../ui.tsx";
import { Modal } from "../modal.tsx";

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

// Acciones de fila reveladas al pasar el ratón / enfocar (accesibles por teclado).
const rowActionsCss = `
.term-actions { opacity: 0; transition: opacity 0.1s ease; font-size: 0.82rem; margin-top: 0.3rem; }
tr:hover .term-actions, tr:focus-within .term-actions { opacity: 1; }
.term-actions button { border: 0; background: transparent; padding: 0; cursor: pointer; font: inherit; color: #2271b1; }
.term-actions .danger { color: #b32d2e; }
.term-actions .sep { color: #c3c4c7; margin: 0 0.3rem; }
`;

const th: CSSProperties = { textAlign: "left", borderBottom: "1px solid #dcdcde", padding: "0.55rem", fontWeight: 600 };
const td: CSSProperties = { borderBottom: "1px solid #eee", padding: "0.55rem", verticalAlign: "top" };
const editInput: CSSProperties = { ...inputStyle, padding: "0.35rem 0.5rem", fontSize: "0.9rem" };

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
    <Page wide>
      <style>{rowActionsCss}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{title}</h1>
        <Button type="button" onClick={openModal}>+ Añadir {singular}</Button>
      </div>
      <p style={{ color: "#666", marginTop: "-0.5rem" }}>{subtitle}</p>

      {query.isLoading && <Loading />}
      {query.isError && <ErrorBox error={query.error} />}
      {(removeTerms.isError || saveEdits.isError) && <ErrorBox error={removeTerms.error ?? saveEdits.error} />}
      {query.data?.terms.length === 0 && <Empty>Aún no hay {plural}. Crea la primera con “+ Añadir {singular}”.</Empty>}

      {rows.length > 0 && (
        <>
          {/* Barra de acciones en lote (estilo WordPress) */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: "0.75rem 0" }}>
            <label htmlFor={`bulk-${taxonomyKey}`} style={{ position: "absolute", left: "-9999px" }}>Acciones en lote</label>
            <select id={`bulk-${taxonomyKey}`} value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} style={{ ...inputStyle, width: 200 }}>
              <option value="">Acciones en lote</option>
              <option value="edit">Editar</option>
              <option value="delete">Eliminar</option>
            </select>
            <Button ghost type="button" onClick={applyBulk} disabled={!bulkAction || selected.size === 0 || removeTerms.isPending}>
              {removeTerms.isPending ? "Aplicando…" : "Aplicar"}
            </Button>
            {selected.size > 0 && <span style={{ color: "#646970", fontSize: "0.85rem" }}>{selected.size} seleccionada(s)</span>}
          </div>

          {/* Barra de guardado cuando hay filas en edición */}
          {editingIds.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", background: "#f0f6fc", border: "1px solid #c5d9ed", borderRadius: 6, padding: "0.5rem 0.75rem", marginBottom: "0.75rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>Editando {editingIds.length} {editingIds.length === 1 ? singular : plural}</strong>
              <Button type="button" onClick={() => saveEdits.mutate()} disabled={saveEdits.isPending}>{saveEdits.isPending ? "Guardando…" : "Guardar cambios"}</Button>
              <Button ghost type="button" onClick={() => setEditing({})} disabled={saveEdits.isPending}>Cancelar</Button>
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
            <thead>
              <tr>
                <th scope="col" style={{ ...th, width: 40 }}>
                  <input type="checkbox" aria-label="Seleccionar todas" checked={allSelected} onChange={toggleAll} />
                </th>
                <th scope="col" style={th}>Nombre</th>
                <th scope="col" style={th}>Descripción</th>
                <th scope="col" style={th}>ID en URL</th>
                <th scope="col" style={{ ...th, width: 90 }}>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((term) => {
                const edit = editing[term.id];
                return (
                  <tr key={term.id}>
                    <td style={td}>
                      <input type="checkbox" aria-label={`Seleccionar ${term.name}`} checked={selected.has(term.id)} onChange={() => toggleOne(term.id)} />
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {edit ? (
                        <input aria-label={`Nombre de ${term.name}`} style={editInput} value={edit.name} onChange={(e) => updateEdit(term.id, "name", e.target.value)} />
                      ) : (
                        <>
                          {"— ".repeat(term.depth)}
                          {term.name}
                          <div className="term-actions">
                            <button type="button" onClick={() => startEdit([term.id])}>Edición rápida</button>
                            <span className="sep">|</span>
                            <button type="button" className="danger" onClick={() => { if (window.confirm(`¿Eliminar "${term.name}"?`)) removeTerms.mutate([term.id]); }}>Eliminar</button>
                          </div>
                        </>
                      )}
                    </td>
                    <td style={{ ...td, color: "#555" }}>
                      {edit ? (
                        <input aria-label={`Descripción de ${term.name}`} style={editInput} value={edit.description} onChange={(e) => updateEdit(term.id, "description", e.target.value)} />
                      ) : (
                        term.description ?? ""
                      )}
                    </td>
                    <td style={{ ...td, color: "#555" }}>{term.slug}</td>
                    <td style={td}>{term.count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <Modal
        open={open}
        title={`Añadir ${singular}`}
        onClose={() => setOpen(false)}
        footer={
          mode === "one" ? (
            <>
              <Button ghost type="button" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button ghost type="button" disabled={busy || !name.trim()} onClick={() => addOne.mutate({ closeAfter: false })}>
                Añadir y otra
              </Button>
              <Button type="button" disabled={busy || !name.trim()} onClick={() => addOne.mutate({ closeAfter: true })}>
                {addOne.isPending ? "Guardando…" : "Añadir"}
              </Button>
            </>
          ) : (
            <>
              <Button ghost type="button" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="button" disabled={busy || !bulkText.trim()} onClick={() => addBulk.mutate()}>
                {addBulk.isPending ? "Añadiendo…" : "Añadir todas"}
              </Button>
            </>
          )
        }
      >
        <div role="tablist" style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
          <Button ghost={mode !== "one"} type="button" onClick={() => setMode("one")}>Una</Button>
          <Button ghost={mode !== "bulk"} type="button" onClick={() => setMode("bulk")}>Varias (JSON)</Button>
        </div>

        {(addOne.isError || addBulk.isError) && <ErrorBox error={addOne.error ?? addBulk.error} />}

        {mode === "one" ? (
          <>
            <Field label="Nombre" htmlFor="term-name">
              <input id="term-name" placeholder="Ej. Noticias" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Descripción" htmlFor="term-desc">
              <textarea id="term-desc" rows={3} placeholder={`Describe cómo se usa esta ${singular}.`} style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            {hierarchical && (
              <Field label={`${title.slice(0, -1)} superior (opcional)`} htmlFor="term-parent">
                <select id="term-parent" style={inputStyle} value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">Ninguna</option>
                  {rows.map((term) => (
                    <option key={term.id} value={term.id}>
                      {"— ".repeat(term.depth)}
                      {term.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        ) : (
          <Field label={`Pega un array JSON de ${plural}`} htmlFor="term-bulk">
            <textarea
              id="term-bulk"
              rows={9}
              placeholder={BULK_PLACEHOLDER}
              style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", fontSize: "0.85rem" }}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
          </Field>
        )}
      </Modal>
    </Page>
  );
}

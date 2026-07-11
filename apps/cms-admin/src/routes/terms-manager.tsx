import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

export interface TermsManagerProps {
  taxonomyKey: string;
  title: string;
  subtitle: string;
  singular: string; // "categoría" | "etiqueta"
  plural: string; // "categorías" | "etiquetas"
  hierarchical: boolean; // muestra "superior" (padre)
}

/** Gestor de términos reutilizable (Categorías, Etiquetas): tabla + modal de alta. */
export function TermsManager({ taxonomyKey, title, subtitle, singular, plural, hierarchical }: TermsManagerProps) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["taxonomy", taxonomyKey], queryFn: () => cms.taxonomies.get(taxonomyKey) });
  const rows = flattenTerms(query.data?.terms ?? []);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"one" | "bulk">("one");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [bulkText, setBulkText] = useState("");

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
        await cms.taxonomies.upsertTerm(taxonomyKey, {
          name: item.name,
          ...(item.description ? { description: item.description } : {}),
        });
      }
      return items.length;
    },
    onSuccess: () => {
      refresh();
      setBulkText("");
      setOpen(false);
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

  const busy = addOne.isPending || addBulk.isPending;

  return (
    <Page wide>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{title}</h1>
        <Button type="button" onClick={openModal}>+ Añadir {singular}</Button>
      </div>
      <p style={{ color: "#666", marginTop: "-0.5rem" }}>{subtitle}</p>

      {query.isLoading && <Loading />}
      {query.isError && <ErrorBox error={query.error} />}
      {query.data?.terms.length === 0 && <Empty>Aún no hay {plural}. Crea la primera con “+ Añadir {singular}”.</Empty>}

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
        <thead>
          <tr>
            {["Nombre", "Descripción", "ID en URL", "Cantidad"].map((heading) => (
              <th key={heading} scope="col" style={{ textAlign: "left", borderBottom: "1px solid #dcdcde", padding: "0.55rem" }}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((term) => (
            <tr key={term.id}>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.55rem", fontWeight: 600 }}>
                {"— ".repeat(term.depth)}
                {term.name}
              </td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.55rem", color: "#555" }}>{term.description ?? ""}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.55rem", color: "#555" }}>{term.slug}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: "0.55rem" }}>{term.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

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

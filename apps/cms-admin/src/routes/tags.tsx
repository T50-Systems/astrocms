import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { cms } from "../lib.ts";
import { Button, Empty, ErrorBox, Field, inputStyle, Loading, Page } from "../ui.tsx";

export function TagsPage() {
  const qc = useQueryClient();
  const tags = useQuery({ queryKey: ["taxonomy", "tag"], queryFn: () => cms.taxonomies.get("tag") });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const save = useMutation({
    mutationFn: () =>
      cms.taxonomies.upsertTerm("tag", {
        name: name.trim(),
        description: description.trim(),
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["taxonomy", "tag"] });
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    save.mutate();
  };

  return (
    <Page wide>
      <h1>Etiquetas</h1>
      <p style={{ color: "#666", marginTop: "-0.5rem" }}>Agrupa contenido con términos planos y flexibles.</p>
      {tags.isLoading && <Loading />}
      {(tags.isError || save.isError) && <ErrorBox error={tags.error ?? save.error} />}
      {tags.data?.terms.length === 0 && <Empty>Aún no hay etiquetas. Crea la primera abajo.</Empty>}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.25rem", alignItems: "start" }}>
        <form onSubmit={submit}>
          <h2 style={{ fontSize: "1.1rem" }}>Añadir nueva etiqueta</h2>
          <Field label="Nombre" htmlFor="tag-name">
            <input
              id="tag-name"
              placeholder="Ej. Salud"
              style={inputStyle}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Descripción" htmlFor="tag-description">
            <textarea
              id="tag-description"
              placeholder="Describe cuándo usar esta etiqueta."
              rows={4}
              style={inputStyle}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={save.isPending || !name.trim()}>
            {save.isPending ? "Guardando…" : "Añadir etiqueta"}
          </Button>
        </form>

        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
          <thead>
            <tr>
              {["Nombre", "Descripción", "ID en URL", "Cantidad"].map((heading) => (
                <th key={heading} style={{ textAlign: "left", borderBottom: "1px solid #dcdcde", padding: "0.55rem" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(tags.data?.terms ?? []).map((term) => (
              <tr key={term.id}>
                <td style={{ borderBottom: "1px solid #eee", padding: "0.55rem", fontWeight: 600 }}>{term.name}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: "0.55rem", color: "#555" }}>{term.description ?? ""}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: "0.55rem", color: "#555" }}>{term.slug}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: "0.55rem" }}>{term.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}

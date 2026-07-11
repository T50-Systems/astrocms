import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { cms } from "../lib.ts";
import { Button, Empty, ErrorBox, Field, inputStyle, Loading, Page } from "../ui.tsx";

export function TaxonomiesPage() {
  const qc = useQueryClient();
  const category = useQuery({ queryKey: ["taxonomy", "category"], queryFn: () => cms.taxonomies.get("category") });
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const save = useMutation({
    mutationFn: () => cms.taxonomies.upsertTerm("category", { name: name.trim(), slug: slug.trim() }),
    onSuccess: () => {
      setName("");
      setSlug("");
      qc.invalidateQueries({ queryKey: ["taxonomy", "category"] });
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    save.mutate();
  };

  return (
    <Page>
      <h1>Categorías</h1>
      <p style={{ color: "#666", marginTop: "-0.5rem" }}>Clasifica tus páginas y entradas en grupos.</p>
      {category.isLoading && <Loading />}
      {(category.isError || save.isError) && <ErrorBox error={category.error ?? save.error} />}
      {category.data?.terms.length === 0 && <Empty>Aún no hay categorías. Crea la primera abajo.</Empty>}
      <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {category.data?.terms.map((term) => (
          <div key={term.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #eee", padding: "0.5rem 0" }}>
            <strong>{term.name}</strong>
            <span style={{ color: "#666" }}>{term.slug}</span>
          </div>
        ))}
      </div>

      <form onSubmit={submit}>
        <Field label="Nombre" htmlFor="term-name">
          <input id="term-name" style={inputStyle} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Slug" htmlFor="term-slug">
          <input id="term-slug" style={inputStyle} value={slug} onChange={(event) => setSlug(event.target.value)} />
        </Field>
        <Button type="submit" disabled={save.isPending || !name.trim() || !slug.trim()}>
          {save.isPending ? "Guardando..." : "Añadir categoría"}
        </Button>
      </form>
    </Page>
  );
}

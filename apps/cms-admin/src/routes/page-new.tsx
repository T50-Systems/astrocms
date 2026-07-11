import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { cms } from "../lib.ts";
import { Button, ErrorBox, Page } from "../ui.tsx";

const formSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  body: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function NewPage() {
  const nav = useNavigate();
  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", body: "" },
  });

  const create = useMutation({
    // La dirección web (slug) se genera sola a partir del título, como WordPress.
    mutationFn: (v: FormValues) =>
      cms.pages.create({
        contentTypeKey: "page",
        title: v.title,
        editorType: "rich-text",
        data: { body: v.body ?? "" },
      }),
    onSuccess: (entry) => nav({ to: "/pages/$pageId", params: { pageId: entry.id } }),
  });

  return (
    <Page wide>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
        <Link to="/" style={{ color: "#2271b1" }}>← Páginas</Link>
        <Button type="submit" form="new-page-form" disabled={create.isPending}>
          {create.isPending ? "Creando…" : "Crear borrador"}
        </Button>
      </div>
      {create.isError && <ErrorBox error={create.error} />}
      <form id="new-page-form" onSubmit={handleSubmit((v) => create.mutate(v))} noValidate style={{ maxWidth: "48rem" }}>
        <input
          aria-label="Título"
          placeholder="Añade un título"
          style={{ width: "100%", border: 0, outline: 0, background: "transparent", fontSize: "2rem", fontWeight: 700, padding: "0.2rem 0", marginBottom: "0.25rem", boxSizing: "border-box" }}
          {...register("title")}
        />
        {formState.errors.title?.message && (
          <div role="alert" style={{ color: "#b00020", fontSize: "0.82rem", marginBottom: "0.75rem" }}>{formState.errors.title.message}</div>
        )}
        <textarea
          aria-label="Contenido"
          placeholder="Escribe el contenido de la página…"
          rows={16}
          style={{ width: "100%", border: "1px solid #dcdcde", borderRadius: 8, padding: "1rem", fontSize: "1rem", lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box", background: "#fff", minHeight: "24rem", marginTop: "0.75rem" }}
          {...register("body")}
        />
      </form>
    </Page>
  );
}

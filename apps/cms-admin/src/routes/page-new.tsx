import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { cms } from "../lib.ts";
import { Button, ErrorBox, Field, inputStyle, Page } from "../ui.tsx";

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
    <Page>
      <h1>Nueva página</h1>
      {create.isError && <ErrorBox error={create.error} />}
      <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
        <Field label="Título" htmlFor="title" error={formState.errors.title?.message}>
          <input id="title" placeholder="Ej. Sobre nosotros" style={inputStyle} {...register("title")} />
        </Field>
        <Field label="Contenido" htmlFor="body">
          <textarea id="body" rows={5} style={inputStyle} {...register("body")} />
        </Field>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Creando…" : "Crear borrador"}
        </Button>
      </form>
    </Page>
  );
}

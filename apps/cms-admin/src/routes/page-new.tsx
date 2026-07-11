import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { slugSchema } from "@astrocms/contracts";
import { cms } from "../lib.ts";
import { Button, ErrorBox, Field, inputStyle, Page } from "../ui.tsx";

const formSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  slug: z.union([slugSchema, z.literal("")]).optional(),
  body: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function NewPage() {
  const nav = useNavigate();
  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", slug: "", body: "" },
  });

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      cms.pages.create({
        contentTypeKey: "page",
        title: v.title,
        editorType: "rich-text",
        ...(v.slug ? { slug: v.slug } : {}),
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
          <input id="title" style={inputStyle} {...register("title")} />
        </Field>
        <Field label="Slug (opcional, p.ej. /acerca)" htmlFor="slug" error={formState.errors.slug?.message}>
          <input id="slug" placeholder="/mi-pagina" style={inputStyle} {...register("slug")} />
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

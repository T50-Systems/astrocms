import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { cms } from "../lib.ts";
import { PageContainer } from "@/components/page-container.tsx";
import { Alert } from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";

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
      cms.pages.create({ contentTypeKey: "page", title: v.title, editorType: "rich-text", data: { body: v.body ?? "" } }),
    onSuccess: (entry) => nav({ to: "/pages/$pageId", params: { pageId: entry.id } }),
  });

  return (
    <PageContainer>
      <div className="mb-5 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-1 text-sm text-primary hover:underline">
          <ChevronLeft className="size-4" /> Páginas
        </Link>
        <Button type="submit" form="new-page-form" loading={create.isPending}>{create.isPending ? "Creando…" : "Crear borrador"}</Button>
      </div>
      {create.isError && <Alert className="mb-3">{create.error.message}</Alert>}
      <form id="new-page-form" onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="max-w-3xl">
        <input
          aria-label="Título"
          placeholder="Añade un título"
          className="w-full border-0 bg-transparent p-1 text-3xl font-bold outline-none placeholder:text-muted-foreground"
          {...register("title")}
        />
        {formState.errors.title?.message && <div role="alert" className="mb-2 text-xs text-destructive">{formState.errors.title.message}</div>}
        <textarea
          aria-label="Contenido"
          placeholder="Escribe el contenido de la página…"
          rows={16}
          className="mt-3 min-h-96 w-full rounded-lg border bg-card p-4 text-base leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("body")}
        />
      </form>
    </PageContainer>
  );
}

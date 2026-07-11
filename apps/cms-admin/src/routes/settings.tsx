import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { cms } from "../lib.ts";
import { Button, ErrorBox, Field, inputStyle, Loading, Page } from "../ui.tsx";

const formSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings", "site"], queryFn: () => cms.settings.get("site") });
  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      title: typeof settings.data?.values.title === "string" ? settings.data.values.title : "",
      description: typeof settings.data?.values.description === "string" ? settings.data.values.description : "",
    },
  });

  const save = useMutation({
    mutationFn: (values: FormValues) => cms.settings.set("site", values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "site"] }),
  });

  if (settings.isLoading) return <Page><Loading /></Page>;

  return (
    <Page>
      <h1>Ajustes del sitio</h1>
      {(settings.isError || save.isError) && <ErrorBox error={settings.error ?? save.error} />}
      <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate>
        <Field label="Título" htmlFor="site-title" error={formState.errors.title?.message}>
          <input id="site-title" style={inputStyle} {...register("title")} />
        </Field>
        <Field label="Descripción" htmlFor="site-description" error={formState.errors.description?.message}>
          <textarea id="site-description" rows={4} style={inputStyle} {...register("description")} />
        </Field>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Guardando..." : "Guardar ajustes"}</Button>
      </form>
    </Page>
  );
}

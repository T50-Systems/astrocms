import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { CSSProperties, ReactNode } from "react";
import { z } from "zod";
import { cms } from "../lib.ts";
import { Button, ErrorBox, Field, inputStyle, Loading, Page } from "../ui.tsx";

const formSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  description: z.string().optional(),
  siteUrl: z.string().url("Debe ser una URL válida (https://…)").or(z.literal("")).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  ogImage: z.string().url("Debe ser una URL válida").or(z.literal("")).optional(),
  logoUrl: z.string().url("Debe ser una URL válida").or(z.literal("")).optional(),
  brandColor: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
];
const TIMEZONES = [
  "America/Santo_Domingo",
  "America/New_York",
  "America/Mexico_City",
  "America/Bogota",
  "America/Argentina/Buenos_Aires",
  "Europe/Madrid",
  "Europe/London",
  "UTC",
];

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const sectionCard: CSSProperties = { background: "#fff", border: "1px solid #dcdcde", borderRadius: 8, padding: "1.1rem 1.25rem", marginBottom: "1rem" };

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section style={sectionCard}>
      <h2 style={{ margin: "0 0 0.15rem", fontSize: "1.05rem" }}>{title}</h2>
      {description && <p style={{ margin: "0 0 1rem", color: "#646970", fontSize: "0.85rem" }}>{description}</p>}
      {children}
    </section>
  );
}

export function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings", "site"], queryFn: () => cms.settings.get("site") });
  const v = settings.data?.values ?? {};

  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      title: str(v.title),
      description: str(v.description),
      siteUrl: str(v.siteUrl),
      language: str(v.language) || "es",
      timezone: str(v.timezone) || "America/Santo_Domingo",
      seoTitle: str(v.seoTitle),
      seoDescription: str(v.seoDescription),
      ogImage: str(v.ogImage),
      logoUrl: str(v.logoUrl),
      brandColor: str(v.brandColor) || "#2271b1",
    },
  });

  const save = useMutation({
    mutationFn: (values: FormValues) => cms.settings.set("site", values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "site"] }),
  });

  if (settings.isLoading) return <Page><Loading /></Page>;

  return (
    <Page wide>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Ajustes</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {save.isSuccess && !save.isPending && <span style={{ color: "#0a6b2e", fontSize: "0.85rem" }}>Guardado ✓</span>}
          <Button type="submit" form="settings-form" disabled={save.isPending}>{save.isPending ? "Guardando…" : "Guardar cambios"}</Button>
        </div>
      </div>

      {(settings.isError || save.isError) && <ErrorBox error={settings.error ?? save.error} />}

      <form id="settings-form" onSubmit={handleSubmit((values) => save.mutate(values))} noValidate style={{ maxWidth: "46rem" }}>
        <Section title="General del sitio" description="Nombre y datos básicos que identifican tu sitio.">
          <Field label="Título del sitio" htmlFor="site-title" error={formState.errors.title?.message}>
            <input id="site-title" style={inputStyle} {...register("title")} />
          </Field>
          <Field label="Lema" htmlFor="site-description" error={formState.errors.description?.message}>
            <input id="site-description" placeholder="En pocas palabras, de qué trata tu sitio" style={inputStyle} {...register("description")} />
          </Field>
          <Field label="Dirección del sitio (URL)" htmlFor="site-url" error={formState.errors.siteUrl?.message}>
            <input id="site-url" placeholder="https://misitio.com" style={inputStyle} {...register("siteUrl")} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <Field label="Idioma" htmlFor="site-language">
              <select id="site-language" style={inputStyle} {...register("language")}>
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="Zona horaria" htmlFor="site-timezone">
              <select id="site-timezone" style={inputStyle} {...register("timezone")}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="SEO por defecto" description="Se usan cuando una página no define los suyos propios.">
          <Field label="Meta título por defecto" htmlFor="seo-title" error={formState.errors.seoTitle?.message}>
            <input id="seo-title" style={inputStyle} {...register("seoTitle")} />
          </Field>
          <Field label="Meta descripción por defecto" htmlFor="seo-description" error={formState.errors.seoDescription?.message}>
            <textarea id="seo-description" rows={3} style={inputStyle} {...register("seoDescription")} />
          </Field>
          <Field label="Imagen para compartir (Open Graph)" htmlFor="og-image" error={formState.errors.ogImage?.message}>
            <input id="og-image" placeholder="https://…/imagen.jpg" style={inputStyle} {...register("ogImage")} />
          </Field>
        </Section>

        <Section title="Marca" description="Logo y color principal del sitio.">
          <Field label="URL del logo" htmlFor="logo-url" error={formState.errors.logoUrl?.message}>
            <input id="logo-url" placeholder="https://…/logo.png" style={inputStyle} {...register("logoUrl")} />
          </Field>
          <Field label="Color principal" htmlFor="brand-color">
            <input id="brand-color" type="color" style={{ ...inputStyle, width: 64, height: 40, padding: 2 }} {...register("brandColor")} />
          </Field>
        </Section>
      </form>
    </Page>
  );
}

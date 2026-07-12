import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { ReactNode } from "react";
import { z } from "zod";
import { cms } from "../lib.ts";
import { JsonTextarea } from "@/components/json-textarea.tsx";
import { ModeToggle } from "@/components/mode-toggle.tsx";
import { PageContainer } from "@/components/page-container.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";

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

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function FormField({ id, label, error, children }: { id: string; label: string; error?: string | undefined; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings", "site"], queryFn: () => cms.settings.get("site") });
  const v = settings.data?.values ?? {};

  const { register, handleSubmit, formState, getValues, reset, control } = useForm<FormValues>({
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

  const [mode, setMode] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");

  const showJson = () => {
    setJsonText(JSON.stringify(getValues(), null, 2));
    setJsonError("");
    setMode("json");
  };
  const editJson = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      // Fusiona con los valores actuales para no perder claves ausentes.
      reset({ ...getValues(), ...parsed }, { keepDefaultValues: true });
      setJsonError("");
    } catch {
      setJsonError("JSON no válido — corrige el formato para guardar los cambios.");
    }
  };

  const save = useMutation({
    mutationFn: (values: FormValues) => cms.settings.set("site", values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "site"] }),
  });

  if (settings.isLoading) return <PageContainer><p className="text-muted-foreground">Cargando…</p></PageContainer>;

  const generalError = settings.error ?? save.error;

  return (
    <PageContainer>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <div className="flex flex-wrap items-center gap-2">
          {save.isSuccess && !save.isPending && (
            <span role="status" className="text-sm text-success-ink">Guardado ✓</span>
          )}
          <ModeToggle
            value={mode}
            options={[{ value: "form", label: "Formulario" }, { value: "json", label: "JSON" }]}
            ariaLabel="Modo de edición"
            onChange={(val) => (val === "json" ? showJson() : setMode("form"))}
          />
          <Button type="submit" form="settings-form" disabled={save.isPending || Boolean(jsonError)}>
            {save.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {(settings.isError || save.isError) && generalError && (
        <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {generalError.message}
        </p>
      )}

      <form id="settings-form" onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="max-w-2xl">
        {mode === "form" ? (
          <>
            <Section title="General del sitio" description="Nombre y datos básicos que identifican tu sitio.">
              <FormField id="site-title" label="Título del sitio" error={formState.errors.title?.message}>
                <Input
                  id="site-title"
                  aria-invalid={!!formState.errors.title}
                  aria-describedby={formState.errors.title ? "site-title-error" : undefined}
                  {...register("title")}
                />
              </FormField>
              <FormField id="site-description" label="Lema" error={formState.errors.description?.message}>
                <Input
                  id="site-description"
                  placeholder="En pocas palabras, de qué trata tu sitio"
                  aria-invalid={!!formState.errors.description}
                  aria-describedby={formState.errors.description ? "site-description-error" : undefined}
                  {...register("description")}
                />
              </FormField>
              <FormField id="site-url" label="Dirección del sitio (URL)" error={formState.errors.siteUrl?.message}>
                <Input
                  id="site-url"
                  placeholder="https://misitio.com"
                  aria-invalid={!!formState.errors.siteUrl}
                  aria-describedby={formState.errors.siteUrl ? "site-url-error" : undefined}
                  {...register("siteUrl")}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField id="site-language" label="Idioma" error={formState.errors.language?.message}>
                  <Controller
                    name="language"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value ?? "es"} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="site-language"
                          aria-invalid={!!formState.errors.language}
                          aria-describedby={formState.errors.language ? "site-language-error" : undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField id="site-timezone" label="Zona horaria" error={formState.errors.timezone?.message}>
                  <Controller
                    name="timezone"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value ?? "America/Santo_Domingo"} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="site-timezone"
                          aria-invalid={!!formState.errors.timezone}
                          aria-describedby={formState.errors.timezone ? "site-timezone-error" : undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </div>
            </Section>

            <Section title="SEO por defecto" description="Se usan cuando una página no define los suyos propios.">
              <FormField id="seo-title" label="Meta título por defecto" error={formState.errors.seoTitle?.message}>
                <Input
                  id="seo-title"
                  aria-invalid={!!formState.errors.seoTitle}
                  aria-describedby={formState.errors.seoTitle ? "seo-title-error" : undefined}
                  {...register("seoTitle")}
                />
              </FormField>
              <FormField id="seo-description" label="Meta descripción por defecto" error={formState.errors.seoDescription?.message}>
                <Textarea
                  id="seo-description"
                  rows={3}
                  aria-invalid={!!formState.errors.seoDescription}
                  aria-describedby={formState.errors.seoDescription ? "seo-description-error" : undefined}
                  {...register("seoDescription")}
                />
              </FormField>
              <FormField id="og-image" label="Imagen para compartir (Open Graph)" error={formState.errors.ogImage?.message}>
                <Input
                  id="og-image"
                  placeholder="https://…/imagen.jpg"
                  aria-invalid={!!formState.errors.ogImage}
                  aria-describedby={formState.errors.ogImage ? "og-image-error" : undefined}
                  {...register("ogImage")}
                />
              </FormField>
            </Section>

            <Section title="Marca" description="Logo y color principal del sitio.">
              <FormField id="logo-url" label="URL del logo" error={formState.errors.logoUrl?.message}>
                <Input
                  id="logo-url"
                  placeholder="https://…/logo.png"
                  aria-invalid={!!formState.errors.logoUrl}
                  aria-describedby={formState.errors.logoUrl ? "logo-url-error" : undefined}
                  {...register("logoUrl")}
                />
              </FormField>
              <FormField id="brand-color" label="Color principal" error={formState.errors.brandColor?.message}>
                <input
                  id="brand-color"
                  type="color"
                  className="h-10 w-16 cursor-pointer rounded-md border border-input bg-background p-1"
                  aria-invalid={!!formState.errors.brandColor}
                  aria-describedby={formState.errors.brandColor ? "brand-color-error" : undefined}
                  {...register("brandColor")}
                />
              </FormField>
            </Section>
          </>
        ) : (
          <JsonTextarea id="settings-json" label="Ajustes en formato JSON" value={jsonText} onChange={editJson} error={jsonError} />
        )}
      </form>
    </PageContainer>
  );
}

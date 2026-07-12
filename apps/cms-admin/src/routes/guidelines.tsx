import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { cms } from "../lib.ts";
import { JsonTextarea } from "@/components/json-textarea.tsx";
import { ModeToggle } from "@/components/mode-toggle.tsx";
import { PageContainer } from "@/components/page-container.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { cn } from "@/lib/utils.ts";

const GROUP = "ai-guidelines";

interface Guidelines {
  site: string;
  copy: string;
  images: string;
  blocks: string;
  additional: string;
}
const EMPTY: Guidelines = { site: "", copy: "", images: "", blocks: "", additional: "" };

const FIELDS: Array<{ key: keyof Guidelines; title: string; help: string; placeholder: string }> = [
  { key: "site", title: "Sitio", help: "Propósito, objetivos y público principal del sitio.", placeholder: "Ej. Tienda de café de especialidad para clientes en RD; tono cercano y experto…" },
  { key: "copy", title: "Tono y estilo", help: "Cómo debe escribir la IA: voz, estilo y formato.", placeholder: "Ej. Frases cortas, segunda persona, sin tecnicismos, evita superlativos…" },
  { key: "images", title: "Imágenes", help: "Estilo, dimensiones, formatos y estética preferidos.", placeholder: "Ej. Fotografía natural, luz cálida, 16:9, sin texto incrustado…" },
  { key: "blocks", title: "Bloques", help: "Directrices para tipos de bloque concretos del builder.", placeholder: "Ej. El Hero siempre lleva un CTA; las listas, máximo 5 puntos…" },
  { key: "additional", title: "Adicional", help: "Cualquier otra directriz que la IA deba respetar.", placeholder: "Ej. No mencionar precios; incluir siempre aviso legal en el pie…" },
];

const str = (o: Record<string, unknown>, k: string): string => (typeof o[k] === "string" ? (o[k] as string) : "");
const toGuidelines = (o: Record<string, unknown>): Guidelines => ({
  site: str(o, "site"),
  copy: str(o, "copy"),
  images: str(o, "images"),
  blocks: str(o, "blocks"),
  additional: str(o, "additional"),
});

export function GuidelinesPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings", GROUP], queryFn: () => cms.settings.get(GROUP) });
  const [form, setForm] = useState<Guidelines>(EMPTY);
  const [notice, setNotice] = useState<string>("");
  const [mode, setMode] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState<string>("");
  const [jsonError, setJsonError] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Carga inicial desde el servidor (una vez que llegan los datos).
  useEffect(() => {
    const v = settings.data?.values;
    if (v) setForm(toGuidelines(v));
  }, [settings.data]);

  const showJson = () => {
    setJsonText(JSON.stringify(form, null, 2));
    setJsonError("");
    setMode("json");
  };
  const editJson = (text: string) => {
    setJsonText(text);
    setNotice("");
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      setForm(toGuidelines(parsed));
      setJsonError("");
    } catch {
      setJsonError("JSON no válido — corrige el formato para guardar los cambios.");
    }
  };

  const save = useMutation({
    mutationFn: (g: Guidelines) => cms.settings.set(GROUP, { ...g } as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", GROUP] });
      setNotice("Guardado ✓");
    },
  });

  const update = (key: keyof Guidelines, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setNotice("");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(form, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "guias-ia.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const next = toGuidelines(parsed);
      setForm(next);
      if (mode === "json") setJsonText(JSON.stringify(next, null, 2));
      setNotice("Importado. Revisa y guarda para aplicar.");
    } catch {
      setNotice("El archivo no es un JSON válido.");
    }
  };

  if (settings.isLoading) return <PageContainer><p role="status" className="text-muted-foreground">Cargando…</p></PageContainer>;

  const generalError = settings.error ?? save.error;

  return (
    <PageContainer>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Guías de IA</h1>
        <div className="flex flex-wrap items-center gap-2">
          {notice && (
            <span role="status" className={cn("text-sm", notice.startsWith("Guardado") ? "text-success-ink" : "text-muted-foreground")}>
              {notice}
            </span>
          )}
          <ModeToggle
            value={mode}
            options={[{ value: "form", label: "Formulario" }, { value: "json", label: "JSON" }]}
            onChange={(v) => (v === "json" ? showJson() : setMode("form"))}
            ariaLabel="Modo de edición"
          />
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ""; }} />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>Importar JSON</Button>
          <Button type="button" variant="outline" onClick={exportJson}>Exportar JSON</Button>
          <Button type="button" onClick={() => save.mutate(form)} disabled={save.isPending || Boolean(jsonError)}>
            {save.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
      <p className="mb-5 max-w-2xl text-muted-foreground">
        Directrices que guían a la IA al generar contenido e imágenes para tu sitio. Se guardan y quedan disponibles
        para las herramientas de IA (SDK / servidor MCP).
      </p>

      {(settings.isError || save.isError) && generalError && (
        <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{generalError.message}</p>
      )}

      {mode === "form" ? (
        <div className="flex max-w-2xl flex-col gap-3">
          {FIELDS.map((field) => (
            <Card key={field.key}>
              <CardHeader>
                <CardTitle className="text-base">
                  <Label htmlFor={`gl-${field.key}`}>{field.title}</Label>
                </CardTitle>
                <CardDescription>{field.help}</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea id={`gl-${field.key}`} rows={4} placeholder={field.placeholder}
                  value={form[field.key]} onChange={(e) => update(field.key, e.target.value)} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="max-w-2xl">
          <JsonTextarea id="gl-json" label="Guías en formato JSON" value={jsonText} onChange={editJson} error={jsonError} />
        </div>
      )}
    </PageContainer>
  );
}

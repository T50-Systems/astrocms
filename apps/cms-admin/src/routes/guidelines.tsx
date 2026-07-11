import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { cms } from "../lib.ts";
import { Button, ErrorBox, Loading, Page } from "../ui.tsx";

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

const sectionCard: CSSProperties = { background: "#fff", border: "1px solid #dcdcde", borderRadius: 8, padding: "1.1rem 1.25rem", marginBottom: "1rem" };
const labelStyle: CSSProperties = { display: "block", fontWeight: 600, marginBottom: "0.15rem", fontSize: "0.95rem" };
const helpStyle: CSSProperties = { margin: "0 0 0.5rem", color: "#646970", fontSize: "0.82rem" };
const textareaStyle: CSSProperties = { width: "100%", padding: "0.6rem 0.7rem", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.9rem", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box", resize: "vertical" };

const str = (o: Record<string, unknown>, k: string): string => (typeof o[k] === "string" ? (o[k] as string) : "");
const toGuidelines = (o: Record<string, unknown>): Guidelines => ({
  site: str(o, "site"),
  copy: str(o, "copy"),
  images: str(o, "images"),
  blocks: str(o, "blocks"),
  additional: str(o, "additional"),
});

const toggleBtn = (active: boolean): CSSProperties => ({
  border: "1px solid #c3c4c7",
  background: active ? "#2271b1" : "#fff",
  color: active ? "#fff" : "#1a1a1a",
  cursor: "pointer",
  padding: "0.35rem 0.7rem",
  fontSize: "0.85rem",
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

  if (settings.isLoading) return <Page><Loading /></Page>;

  return (
    <Page wide>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.25rem" }}>
        <h1 style={{ margin: 0 }}>Guías de IA</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {notice && <span style={{ color: notice.startsWith("Guardado") ? "#0a6b2e" : "#646970", fontSize: "0.85rem" }}>{notice}</span>}
          <div style={{ display: "flex" }} role="group" aria-label="Modo de edición">
            <button type="button" onClick={() => setMode("form")} aria-pressed={mode === "form"} style={{ ...toggleBtn(mode === "form"), borderRadius: "6px 0 0 6px" }}>Formulario</button>
            <button type="button" onClick={showJson} aria-pressed={mode === "json"} style={{ ...toggleBtn(mode === "json"), borderRadius: "0 6px 6px 0", borderLeft: 0 }}>JSON</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ""; }} />
          <Button ghost type="button" onClick={() => fileRef.current?.click()}>Importar JSON</Button>
          <Button ghost type="button" onClick={exportJson}>Exportar JSON</Button>
          <Button type="button" onClick={() => save.mutate(form)} disabled={save.isPending || Boolean(jsonError)}>{save.isPending ? "Guardando…" : "Guardar cambios"}</Button>
        </div>
      </div>
      <p style={{ color: "#666", marginTop: 0, maxWidth: "46rem" }}>
        Directrices que guían a la IA al generar contenido e imágenes para tu sitio. Se guardan y quedan disponibles
        para las herramientas de IA (SDK / servidor MCP).
      </p>

      {(settings.isError || save.isError) && <ErrorBox error={settings.error ?? save.error} />}

      {mode === "form" ? (
        <div style={{ maxWidth: "46rem" }}>
          {FIELDS.map((field) => (
            <section key={field.key} style={sectionCard}>
              <label style={labelStyle} htmlFor={`gl-${field.key}`}>{field.title}</label>
              <p style={helpStyle}>{field.help}</p>
              <textarea id={`gl-${field.key}`} rows={4} style={textareaStyle} placeholder={field.placeholder}
                value={form[field.key]} onChange={(e) => update(field.key, e.target.value)} />
            </section>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: "46rem" }}>
          <label htmlFor="gl-json" style={{ position: "absolute", left: "-9999px" }}>Guías en formato JSON</label>
          <textarea id="gl-json" spellCheck={false} rows={22} value={jsonText} onChange={(e) => editJson(e.target.value)}
            aria-invalid={Boolean(jsonError)}
            style={{ width: "100%", padding: "0.9rem 1rem", borderRadius: 8, border: `1px solid ${jsonError ? "#d63638" : "#dcdcde"}`, background: "#1d2327", color: "#e6e6e6", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.85rem", lineHeight: 1.5, boxSizing: "border-box", resize: "vertical" }} />
          {jsonError && <div role="alert" style={{ color: "#d63638", fontSize: "0.82rem", marginTop: "0.4rem" }}>{jsonError}</div>}
        </div>
      )}
    </Page>
  );
}

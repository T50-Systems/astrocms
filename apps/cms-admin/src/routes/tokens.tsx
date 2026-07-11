import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { cms } from "../lib.ts";
import { Button, ErrorBox, Loading, Page } from "../ui.tsx";

const GROUP = "design-tokens";
const TYPES = ["color", "dimension", "fontFamily", "fontWeight", "number", "duration", "shadow", "other"];

interface FlatToken {
  id: string;
  path: string;
  type: string;
  value: string;
}

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `t-${Math.random().toString(36).slice(2)}`);

/** Aplana un documento DTCG a filas { path, type, value }. Un nodo es token si tiene $value. */
function flattenDtcg(obj: unknown, prefix = ""): FlatToken[] {
  if (!obj || typeof obj !== "object") return [];
  const rec = obj as Record<string, unknown>;
  if ("$value" in rec) {
    return [{ id: uid(), path: prefix, type: typeof rec.$type === "string" ? rec.$type : "", value: valueToString(rec.$value) }];
  }
  const out: FlatToken[] = [];
  for (const [k, v] of Object.entries(rec)) {
    if (k.startsWith("$")) continue;
    out.push(...flattenDtcg(v, prefix ? `${prefix}.${k}` : k));
  }
  return out;
}
function valueToString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

/** Reconstruye el documento DTCG anidado a partir de las filas. */
function buildDtcg(tokens: FlatToken[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const t of tokens) {
    const path = t.path.trim();
    if (!path) continue;
    const parts = path.split(".").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]!;
      if (typeof node[key] !== "object" || node[key] === null) node[key] = {};
      node = node[key] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]!] = { $value: t.value, ...(t.type ? { $type: t.type } : {}) };
  }
  return root;
}

const card: CSSProperties = { background: "#fff", border: "1px solid #dcdcde", borderRadius: 8, padding: "0.5rem", marginBottom: "1rem" };
const th: CSSProperties = { textAlign: "left", padding: "0.45rem 0.5rem", fontWeight: 600, fontSize: "0.82rem", borderBottom: "1px solid #dcdcde" };
const td: CSSProperties = { padding: "0.35rem 0.5rem", borderBottom: "1px solid #f0f0f1", verticalAlign: "middle" };
const cell: CSSProperties = { width: "100%", padding: "0.35rem 0.5rem", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.85rem", boxSizing: "border-box" };
const toggleBtn = (active: boolean): CSSProperties => ({ border: "1px solid #c3c4c7", background: active ? "#2271b1" : "#fff", color: active ? "#fff" : "#1a1a1a", cursor: "pointer", padding: "0.35rem 0.7rem", fontSize: "0.85rem" });

const EXAMPLE = `{
  "color": {
    "brand": { "$value": "#2271b1", "$type": "color" },
    "text":  { "$value": "#1a1a1a", "$type": "color" }
  },
  "space": {
    "sm": { "$value": "8px", "$type": "dimension" }
  }
}`;

export function TokensPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings", GROUP], queryFn: () => cms.settings.get(GROUP) });
  const [tokens, setTokens] = useState<FlatToken[]>([]);
  const [mode, setMode] = useState<"table" | "json">("table");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings.data) setTokens(flattenDtcg(settings.data.values));
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => cms.settings.set(GROUP, buildDtcg(tokens) as Record<string, unknown>),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings", GROUP] }); setNotice("Guardado ✓"); },
  });

  const update = (id: string, field: "path" | "type" | "value", val: string) => {
    setTokens((cur) => cur.map((t) => (t.id === id ? { ...t, [field]: val } : t)));
    setNotice("");
  };
  const addRow = () => setTokens((cur) => [...cur, { id: uid(), path: "", type: "color", value: "" }]);
  const removeRow = (id: string) => setTokens((cur) => cur.filter((t) => t.id !== id));

  const showJson = () => {
    setJsonText(JSON.stringify(buildDtcg(tokens), null, 2));
    setJsonError("");
    setMode("json");
  };
  const editJson = (text: string) => {
    setJsonText(text);
    setNotice("");
    try {
      setTokens(flattenDtcg(JSON.parse(text)));
      setJsonError("");
    } catch {
      setJsonError("JSON no válido — corrige el formato para guardar.");
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(buildDtcg(tokens), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "design-tokens.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJson = async (file: File) => {
    try {
      const next = flattenDtcg(JSON.parse(await file.text()));
      setTokens(next);
      if (mode === "json") setJsonText(JSON.stringify(buildDtcg(next), null, 2));
      setNotice("Importado. Revisa y guarda para aplicar.");
    } catch {
      setNotice("El archivo no es un DTCG JSON válido.");
    }
  };

  if (settings.isLoading) return <Page><Loading /></Page>;

  return (
    <Page wide>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Tokens de diseño</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          {notice && <span style={{ color: notice.startsWith("Guardado") ? "#0a6b2e" : "#646970", fontSize: "0.85rem" }}>{notice}</span>}
          <div style={{ display: "flex" }} role="group" aria-label="Modo de edición">
            <button type="button" onClick={() => setMode("table")} aria-pressed={mode === "table"} style={{ ...toggleBtn(mode === "table"), borderRadius: "6px 0 0 6px" }}>Tabla</button>
            <button type="button" onClick={showJson} aria-pressed={mode === "json"} style={{ ...toggleBtn(mode === "json"), borderRadius: "0 6px 6px 0", borderLeft: 0 }}>JSON DTCG</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ""; }} />
          <Button ghost type="button" onClick={() => fileRef.current?.click()}>Importar JSON</Button>
          <Button ghost type="button" onClick={exportJson}>Exportar JSON</Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || Boolean(jsonError)}>{save.isPending ? "Guardando…" : "Guardar cambios"}</Button>
        </div>
      </div>
      <p style={{ color: "#666", marginTop: 0, maxWidth: "48rem" }}>
        Colores, espaciados y tipografía en formato estándar <strong>DTCG</strong> (Design Tokens Community Group).
        El sitio los expone como variables CSS (p. ej. <code>color.brand</code> → <code>--color-brand</code>).
      </p>

      {(settings.isError || save.isError) && <ErrorBox error={settings.error ?? save.error} />}

      {mode === "table" ? (
        <>
          <div style={card}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: "38%" }}>Nombre (ruta)</th>
                  <th style={{ ...th, width: 150 }}>Tipo</th>
                  <th style={th}>Valor</th>
                  <th style={{ ...th, width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 && (
                  <tr><td colSpan={4} style={{ ...td, color: "#646970" }}>No hay tokens todavía. Añade el primero o importa un JSON DTCG.</td></tr>
                )}
                {tokens.map((t) => (
                  <tr key={t.id}>
                    <td style={td}>
                      <input aria-label="Ruta del token" placeholder="color.brand" style={{ ...cell, fontFamily: "ui-monospace, monospace" }} value={t.path} onChange={(e) => update(t.id, "path", e.target.value)} />
                    </td>
                    <td style={td}>
                      <select aria-label="Tipo" style={cell} value={t.type} onChange={(e) => update(t.id, "type", e.target.value)}>
                        {TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        {t.type === "color" && (
                          <input type="color" aria-label="Selector de color" value={/^#[0-9a-f]{6}$/i.test(t.value) ? t.value : "#000000"} onChange={(e) => update(t.id, "value", e.target.value)} style={{ width: 34, height: 30, padding: 2, border: "1px solid #ccc", borderRadius: 6, flexShrink: 0 }} />
                        )}
                        <input aria-label="Valor" placeholder="#2271b1 · 8px · Inter" style={cell} value={t.value} onChange={(e) => update(t.id, "value", e.target.value)} />
                      </div>
                    </td>
                    <td style={td}>
                      <button type="button" aria-label="Eliminar token" onClick={() => removeRow(t.id)} style={{ border: 0, background: "transparent", color: "#b32d2e", cursor: "pointer", fontSize: "1.1rem" }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button ghost type="button" onClick={addRow}>+ Añadir token</Button>
        </>
      ) : (
        <div style={{ maxWidth: "48rem" }}>
          <label htmlFor="tokens-json" style={{ position: "absolute", left: "-9999px" }}>Tokens en formato DTCG JSON</label>
          <textarea id="tokens-json" spellCheck={false} rows={22} value={jsonText} onChange={(e) => editJson(e.target.value)} placeholder={EXAMPLE}
            aria-invalid={Boolean(jsonError)}
            style={{ width: "100%", padding: "0.9rem 1rem", borderRadius: 8, border: `1px solid ${jsonError ? "#d63638" : "#dcdcde"}`, background: "#1d2327", color: "#e6e6e6", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.85rem", lineHeight: 1.5, boxSizing: "border-box", resize: "vertical" }} />
          {jsonError && <div role="alert" style={{ color: "#d63638", fontSize: "0.82rem", marginTop: "0.4rem" }}>{jsonError}</div>}
        </div>
      )}
    </Page>
  );
}

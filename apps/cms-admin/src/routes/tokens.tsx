import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cms } from "../lib.ts";
import { JsonTextarea } from "@/components/json-textarea.tsx";
import { ModeToggle } from "@/components/mode-toggle.tsx";
import { PageContainer } from "@/components/page-container.tsx";
import { Alert } from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { cn } from "@/lib/utils.ts";

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

  if (settings.isLoading)
    return (
      <PageContainer>
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageContainer>
    );

  const generalError = settings.error ?? save.error;

  return (
    <PageContainer>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page-title font-semibold tracking-tight">Tokens de diseño</h1>
        <div className="flex flex-wrap items-center gap-2">
          {notice && (
            <span
              role="status"
              className={cn("text-sm", notice.startsWith("Guardado") ? "text-success-ink" : "text-muted-foreground")}
            >
              {notice}
            </span>
          )}
          <ModeToggle
            value={mode}
            options={[{ value: "table", label: "Tabla" }, { value: "json", label: "JSON DTCG" }]}
            onChange={(v) => (v === "json" ? showJson() : setMode("table"))}
            ariaLabel="Modo de edición"
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ""; }}
          />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>Importar JSON</Button>
          <Button type="button" variant="outline" onClick={exportJson}>Exportar JSON</Button>
          <Button type="button" onClick={() => save.mutate()} loading={save.isPending} disabled={Boolean(jsonError)}>
            {save.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground max-w-3xl">
        Colores, espaciados y tipografía en formato estándar <strong>DTCG</strong> (Design Tokens Community Group).
        El sitio los expone como variables CSS (p. ej. <code>color.brand</code> → <code>--color-brand</code>).
      </p>

      {(settings.isError || save.isError) && generalError && (
        <Alert className="mb-3 mt-4">{generalError.message}</Alert>
      )}

      {mode === "table" ? (
        <>
          <div className="mt-5 rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[38%]">Nombre (ruta)</TableHead>
                  <TableHead className="w-[150px]">Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No hay tokens todavía. Añade el primero o importa un JSON DTCG.
                    </TableCell>
                  </TableRow>
                )}
                {tokens.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Input
                        className="h-8 font-mono text-sm"
                        aria-label="Ruta del token"
                        placeholder="color.brand"
                        value={t.path}
                        onChange={(e) => update(t.id, "path", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={t.type} onValueChange={(v) => update(t.id, "type", v)}>
                        <SelectTrigger className="h-8" aria-label="Tipo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPES.map((ty) => <SelectItem key={ty} value={ty}>{ty}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {t.type === "color" && (
                          <input
                            type="color"
                            aria-label="Selector de color"
                            value={/^#[0-9a-f]{6}$/i.test(t.value) ? t.value : "#000000"}
                            onChange={(e) => update(t.id, "value", e.target.value)}
                            className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-input p-0.5"
                          />
                        )}
                        <Input
                          className="h-8 text-sm"
                          aria-label="Valor"
                          placeholder="#2271b1 · 8px · Inter"
                          value={t.value}
                          onChange={(e) => update(t.id, "value", e.target.value)}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar token"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => removeRow(t.id)}
                      >
                        <X />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button type="button" variant="outline" className="mt-3" onClick={addRow}>+ Añadir token</Button>
        </>
      ) : (
        <div className="mt-5 max-w-3xl">
          <JsonTextarea id="tokens-json" label="Tokens en formato DTCG JSON" value={jsonText} onChange={editJson} error={jsonError} placeholder={EXAMPLE} />
        </div>
      )}
    </PageContainer>
  );
}

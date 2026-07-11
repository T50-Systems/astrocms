import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MenuItemInput } from "@astrocms/contracts";
import { cms } from "../lib.ts";
import { Button, Empty, ErrorBox, Field, inputStyle, Loading, Page } from "../ui.tsx";
import { useEffect, useState } from "react";

function normalize(items: MenuItemInput[]): MenuItemInput[] {
  return items.map((item) => ({
    ...(item.id ? { id: item.id } : {}),
    label: item.label,
    linkType: item.linkType,
    ...(item.entryId ? { entryId: item.entryId } : {}),
    ...(item.url ? { url: item.url } : {}),
    ...(item.target ? { target: item.target } : {}),
    children: normalize(item.children ?? []),
  }));
}

function move(items: MenuItemInput[], index: number, delta: number): MenuItemInput[] {
  const next = [...items];
  const target = index + delta;
  const item = next[index];
  if (!item || target < 0 || target >= next.length) return items;
  next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export function MenusPage() {
  const qc = useQueryClient();
  const menu = useQuery({ queryKey: ["menu", "primary"], queryFn: () => cms.menus.get("primary") });
  const pages = useQuery({ queryKey: ["pages", "menu-options"], queryFn: () => cms.pages.list({ pageSize: 100 }) });
  const [items, setItems] = useState<MenuItemInput[]>([]);
  const [label, setLabel] = useState("");
  const [entryId, setEntryId] = useState("");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"entry" | "url">("entry");

  useEffect(() => {
    if (menu.data) setItems(normalize(menu.data.items));
  }, [menu.data]);

  const save = useMutation({
    mutationFn: () => cms.menus.upsert("primary", { name: "Primary", items: normalize(items) }),
    onSuccess: (saved) => {
      setItems(normalize(saved.items));
      qc.invalidateQueries({ queryKey: ["menu", "primary"] });
    },
  });

  const addItem = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (mode === "entry" && entryId) {
      setItems((current) => [...current, { label: trimmed, linkType: "entry", entryId, target: "_self", children: [] }]);
    }
    if (mode === "url" && url.trim()) {
      setItems((current) => [...current, { label: trimmed, linkType: "url", url: url.trim(), target: "_self", children: [] }]);
    }
    setLabel("");
    setUrl("");
  };

  return (
    <Page>
      <h1>Menú primary</h1>
      {menu.isLoading && <Loading />}
      {(menu.isError || pages.isError || save.isError) && <ErrorBox error={menu.error ?? pages.error ?? save.error} />}

      <div style={{ display: "grid", gap: "0.8rem", marginBottom: "1.5rem" }}>
        {items.length === 0 && !menu.isLoading && <Empty>El menú primary está vacío.</Empty>}
        {items.map((item, index) => (
          <div key={`${item.id ?? item.label}-${index}`} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <strong style={{ flex: 1 }}>{item.label}</strong>
            <span style={{ color: "#666", fontSize: "0.85rem" }}>{item.linkType === "entry" ? item.entryId : item.url}</span>
            <Button ghost type="button" onClick={() => setItems((current) => move(current, index, -1))}>Subir</Button>
            <Button ghost type="button" onClick={() => setItems((current) => move(current, index, 1))}>Bajar</Button>
            <Button ghost type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))}>Quitar</Button>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: "1.1rem" }}>Añadir item</h2>
      <Field label="Label" htmlFor="menu-label">
        <input id="menu-label" style={inputStyle} value={label} onChange={(event) => setLabel(event.target.value)} />
      </Field>
      <Field label="Tipo de enlace" htmlFor="menu-mode">
        <select id="menu-mode" style={inputStyle} value={mode} onChange={(event) => setMode(event.target.value === "url" ? "url" : "entry")}>
          <option value="entry">Página</option>
          <option value="url">URL</option>
        </select>
      </Field>
      {mode === "entry" ? (
        <Field label="Página" htmlFor="menu-entry">
          <select id="menu-entry" style={inputStyle} value={entryId} onChange={(event) => setEntryId(event.target.value)}>
            <option value="">Selecciona una página</option>
            {pages.data?.data.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}
          </select>
        </Field>
      ) : (
        <Field label="URL" htmlFor="menu-url">
          <input id="menu-url" style={inputStyle} value={url} onChange={(event) => setUrl(event.target.value)} />
        </Field>
      )}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button type="button" onClick={addItem}>Añadir</Button>
        <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Guardando..." : "Guardar menú"}
        </Button>
      </div>
    </Page>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MenuItemInput } from "@astrocms/contracts";
import { cms } from "../lib.ts";
import { useEffect, useState } from "react";
import { MenuItemTree } from "@/components/menus/menu-item-tree.tsx";
import { indent, moveSibling, outdent, removeAt, updateAt } from "@/components/menus/tree.ts";
import { PageContainer } from "@/components/page-container.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";

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
    <PageContainer className="max-w-3xl">
      <div className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold">Menú principal</h1>
        <p className="text-muted-foreground">
          Son los enlaces de la barra de navegación de tu sitio. Añade cada enlace a la lista y, cuando termines,
          pulsa <strong>Guardar menú</strong>.
        </p>
      </div>
      {menu.isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {(menu.isError || pages.isError || save.isError) && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(menu.error ?? pages.error ?? save.error)?.message}
        </p>
      )}

      <div className="mb-6">
        {items.length === 0 && !menu.isLoading && (
          <p className="text-muted-foreground">Este menú aún no tiene enlaces. Añade el primero abajo.</p>
        )}
        <MenuItemTree
          items={items}
          onMove={(path, delta) => setItems((current) => moveSibling(current, path, delta))}
          onIndent={(path) => setItems((current) => indent(current, path))}
          onOutdent={(path) => setItems((current) => outdent(current, path))}
          onRemove={(path) => setItems((current) => removeAt(current, path))}
          onPatch={(path, patch) => setItems((current) => updateAt(current, path, patch))}
        />
        {items.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Usa → para convertir un enlace en sub-enlace del anterior (submenú) y ← para sacarlo un nivel.
          </p>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Añadir un enlace</h2>
        <div className="space-y-1.5">
          <Label htmlFor="menu-label">Texto del enlace</Label>
          <Input id="menu-label" placeholder="Ej. Inicio, Contacto…" value={label} onChange={(event) => setLabel(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="menu-mode">¿A dónde lleva?</Label>
          <Select value={mode} onValueChange={(value) => setMode(value === "url" ? "url" : "entry")}>
            <SelectTrigger id="menu-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entry">A una página de mi sitio</SelectItem>
              <SelectItem value="url">A una dirección externa (URL)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === "entry" ? (
          <div className="space-y-1.5">
            <Label htmlFor="menu-entry">Página</Label>
            <Select value={entryId} onValueChange={setEntryId}>
              <SelectTrigger id="menu-entry">
                <SelectValue placeholder="Selecciona una página" />
              </SelectTrigger>
              <SelectContent>
                {pages.data?.data.map((page) => <SelectItem key={page.id} value={page.id}>{page.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="menu-url">URL</Label>
            <Input id="menu-url" value={url} onChange={(event) => setUrl(event.target.value)} />
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" type="button" onClick={addItem}>+ Añadir a la lista</Button>
          <span className="text-muted-foreground">·</span>
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Guardando…" : "Guardar menú"}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

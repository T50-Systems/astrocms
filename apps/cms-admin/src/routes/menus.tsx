import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutList } from "lucide-react";
import type { Menu, MenuItemInput } from "@astrocms/contracts";
import { cms } from "../lib.ts";
import { useEffect, useState } from "react";
import { AddPagesPanel } from "@/components/menus/add-pages-panel.tsx";
import { MenuItemTree } from "@/components/menus/menu-item-tree.tsx";
import type { EditableMenuItem } from "@/components/menus/menu-item-tree.tsx";
import { indent, moveSibling, outdent, removeAt, updateAt } from "@/components/menus/tree.ts";
import { PageContainer } from "@/components/page-container.tsx";
import { Alert } from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { TreeSkeleton } from "@/components/skeletons.tsx";

const LOCATIONS = [
  { value: "primary", label: "Menú principal" },
  { value: "footer", label: "Pie de página" },
] as const;

const previewOrigin = import.meta.env.VITE_PREVIEW_ORIGIN ?? "";
type Location = (typeof LOCATIONS)[number]["value"];

const locationLabel = (value: Location): string => LOCATIONS.find((l) => l.value === value)?.label ?? value;

/** Payload del PUT: stripa los campos read-only (url calculada, invalid) que añade el servidor. */
function normalize(items: EditableMenuItem[]): MenuItemInput[] {
  return items.map((item) => ({
    ...(item.id ? { id: item.id } : {}),
    label: item.label,
    linkType: item.linkType,
    ...(item.entryId ? { entryId: item.entryId } : {}),
    ...(item.linkType !== "entry" && item.url ? { url: item.url } : {}),
    ...(item.target ? { target: item.target } : {}),
    ...(item.cssClasses?.length ? { cssClasses: item.cssClasses } : {}),
    ...(item.titleAttr ? { titleAttr: item.titleAttr } : {}),
    ...(item.description ? { description: item.description } : {}),
    children: normalize((item.children ?? []) as EditableMenuItem[]),
  }));
}

/** Estado editable: conserva url/invalid calculados por el servidor para mostrarlos. */
function toEditable(items: Menu["items"]): EditableMenuItem[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    linkType: item.linkType,
    ...(item.entryId ? { entryId: item.entryId } : {}),
    ...(item.url ? { url: item.url } : {}),
    ...(item.target ? { target: item.target } : {}),
    ...(item.invalid ? { invalid: item.invalid } : {}),
    ...(item.cssClasses?.length ? { cssClasses: item.cssClasses } : {}),
    ...(item.titleAttr ? { titleAttr: item.titleAttr } : {}),
    ...(item.description ? { description: item.description } : {}),
    children: toEditable(item.children),
  }));
}

export function MenusPage() {
  const qc = useQueryClient();
  const [location, setLocation] = useState<Location>("primary");
  const menu = useQuery({
    queryKey: ["menu", location],
    queryFn: async (): Promise<Menu> => {
      try {
        return await cms.menus.get(location);
      } catch (err) {
        // 404 = menú aún no creado para esta ubicación: editor vacío (el PUT lo crea).
        if ((err as { status?: number }).status === 404) {
          return { location, name: locationLabel(location), autoAddPages: false, items: [] };
        }
        throw err;
      }
    },
  });
  const pages = useQuery({ queryKey: ["pages", "menu-options"], queryFn: () => cms.pages.list({ pageSize: 100 }) });
  const [items, setItems] = useState<EditableMenuItem[]>([]);
  const [menuName, setMenuName] = useState("");
  const [autoAddPages, setAutoAddPages] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (menu.data) {
      setItems(toEditable(menu.data.items));
      setMenuName(menu.data.name);
      setAutoAddPages(menu.data.autoAddPages ?? false);
    }
  }, [menu.data]);

  const save = useMutation({
    mutationFn: () =>
      cms.menus.upsert(location, { name: menuName.trim() || locationLabel(location), autoAddPages, items: normalize(items) }),
    onSuccess: (saved) => {
      setItems(toEditable(saved.items));
      setPreviewVersion((v) => v + 1); // recarga la vista previa
      qc.invalidateQueries({ queryKey: ["menu", location] });
    },
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  // Recarga del iframe de vista previa: cache-buster en el src (cross-origin,
  // contentWindow.reload() lanzaría SecurityError entre :5173 y :4321).
  const [previewVersion, setPreviewVersion] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const removeMenu = useMutation({
    mutationFn: () => cms.menus.remove(location),
    onSuccess: () => {
      setItems([]);
      setConfirmDelete(false);
      setPreviewVersion((v) => v + 1);
      qc.invalidateQueries({ queryKey: ["menu", location] });
    },
  });

  const addCustomLink = () => {
    const trimmed = label.trim();
    if (!trimmed || !url.trim()) return;
    setItems((current) => [...current, { label: trimmed, linkType: "url", url: url.trim(), target: "_self", children: [] }]);
    setLabel("");
    setUrl("");
  };

  return (
    <PageContainer>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-page-title font-semibold tracking-tight">Menús</h1>
          <p className="text-muted-foreground">
            Son los enlaces de navegación de tu sitio. Elige una ubicación, organiza los enlaces y pulsa{" "}
            <strong>Guardar menú</strong>.
          </p>
        </div>
        {previewOrigin && (
          <Button variant="ghost" size="sm" type="button" aria-pressed={showPreview} onClick={() => setShowPreview((s) => !s)}>
            {showPreview ? "Ocultar vista previa" : "Mostrar vista previa"}
          </Button>
        )}
      </div>
      <div className={showPreview && previewOrigin ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,540px)]" : ""}>
      <div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="menu-location">Editando</Label>
          <Select value={location} onValueChange={(v) => setLocation(v as Location)}>
            <SelectTrigger id="menu-location" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCATIONS.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="menu-name">Nombre del menú</Label>
          <Input id="menu-name" className="w-56" value={menuName} onChange={(e) => setMenuName(e.target.value)} />
        </div>
        <p className="pb-2 text-xs text-muted-foreground">Cambiar de menú descarta los cambios no guardados.</p>
        <span className="flex items-center gap-2 pb-2">
          <Checkbox id="menu-autoadd" checked={autoAddPages} onCheckedChange={(c) => setAutoAddPages(c === true)} />
          <Label htmlFor="menu-autoadd" className="text-xs font-normal text-muted-foreground">
            Añadir automáticamente las páginas nuevas de nivel superior
          </Label>
        </span>
      </div>

      {menu.isLoading && <TreeSkeleton rows={4} />}
      {(menu.isError || pages.isError || save.isError) && (
        <Alert className="mb-3">{(menu.error ?? pages.error ?? save.error)?.message}</Alert>
      )}

      <div className="mb-6">
        {items.length === 0 && !menu.isLoading && (
          <EmptyState icon={LayoutList} title="Este menú aún no tiene enlaces. Añade el primero abajo." />
        )}
        <MenuItemTree
          items={items}
          onMove={(path, delta) => setItems((current) => moveSibling(current, path, delta) as EditableMenuItem[])}
          onIndent={(path) => setItems((current) => indent(current, path) as EditableMenuItem[])}
          onOutdent={(path) => setItems((current) => outdent(current, path) as EditableMenuItem[])}
          onRemove={(path) => setItems((current) => removeAt(current, path) as EditableMenuItem[])}
          onPatch={(path, patch) => setItems((current) => updateAt(current, path, patch) as EditableMenuItem[])}
        />
        {items.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Usa → para convertir un enlace en sub-enlace del anterior (submenú) y ← para sacarlo un nivel.
          </p>
        )}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <AddPagesPanel
          pages={pages.data?.data ?? []}
          onAdd={(selection) =>
            setItems((current) => [
              ...current,
              ...selection.map((p) => ({ label: p.title, linkType: "entry" as const, entryId: p.id, target: "_self" as const, children: [] })),
            ])
          }
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enlace personalizado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="menu-label">Texto del enlace</Label>
              <Input id="menu-label" placeholder="Ej. Contacto…" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menu-url">URL</Label>
              <Input id="menu-url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <Button variant="outline" type="button" onClick={addCustomLink} disabled={!label.trim() || !url.trim()}>
              + Añadir a la lista
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Button type="button" loading={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Guardando…" : "Guardar menú"}
        </Button>
        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
          Eliminar menú
        </Button>
      </div>
      </div>

      {showPreview && previewOrigin && (
        <Card className="p-2">
          <iframe
            title="Vista previa del sitio"
            src={`${previewOrigin}/?v=${previewVersion}`}
            className="h-[70vh] w-full rounded-md border bg-white"
          />
          <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground">
            Vista previa en vivo ({previewOrigin}). Se recarga al guardar.
          </p>
        </Card>
      )}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar “{locationLabel(location)}”?</DialogTitle>
            <DialogDescription>
              Se eliminarán {items.length} enlace(s) de este menú. Las páginas enlazadas no se borran. Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {removeMenu.isError && <Alert>{removeMenu.error.message}</Alert>}
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button variant="destructive" type="button" loading={removeMenu.isPending} onClick={() => removeMenu.mutate()}>
              {removeMenu.isPending ? "Eliminando…" : "Eliminar menú"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

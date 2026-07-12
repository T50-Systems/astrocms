import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronUp, X } from "lucide-react";
import type { MenuItemInput } from "@astrocms/contracts";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";

/** Item editable en la UI: MenuItemInput + campos read-only que el servidor calcula. */
export type EditableMenuItem = MenuItemInput & { url?: string | undefined; invalid?: boolean | undefined };

/** Propiedades avanzadas estilo WordPress, plegadas por defecto (progressive disclosure). */
function AdvancedFields({
  item,
  itemPath,
  idKey,
  onPatch,
}: {
  item: EditableMenuItem;
  itemPath: number[];
  idKey: string;
  onPatch: (path: number[], patch: Partial<MenuItemInput>) => void;
}) {
  const hasValues = Boolean(item.cssClasses?.length || item.titleAttr || item.description);
  const [open, setOpen] = useState(false);
  return (
    <div className="-mt-1 pl-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        Avanzado{!open && hasValues ? " •" : ""}
      </button>
      {open && (
        <div className="mt-2 grid gap-2 rounded-md border bg-card p-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`adv-css-${idKey}`} className="text-xs">Clases CSS (separadas por espacios)</Label>
            <Input
              id={`adv-css-${idKey}`}
              className="h-8 text-sm"
              defaultValue={item.cssClasses?.join(" ") ?? ""}
              onBlur={(e) => onPatch(itemPath, { cssClasses: e.target.value.split(/\s+/).filter(Boolean) })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`adv-title-${idKey}`} className="text-xs">Atributo title</Label>
            <Input
              id={`adv-title-${idKey}`}
              className="h-8 text-sm"
              value={item.titleAttr ?? ""}
              onChange={(e) => onPatch(itemPath, { titleAttr: e.target.value })}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor={`adv-desc-${idKey}`} className="text-xs">Descripción</Label>
            <Textarea
              id={`adv-desc-${idKey}`}
              rows={2}
              className="text-sm"
              value={item.description ?? ""}
              onChange={(e) => onPatch(itemPath, { description: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export interface MenuItemTreeProps {
  items: EditableMenuItem[];
  /** Prefijo de ruta del nivel actual (vacío en la raíz). */
  path?: number[];
  onMove: (path: number[], delta: number) => void;
  onIndent: (path: number[]) => void;
  onOutdent: (path: number[]) => void;
  onRemove: (path: number[]) => void;
  onPatch: (path: number[], patch: Partial<MenuItemInput>) => void;
}

/** Árbol recursivo de items de menú con controles estilo WordPress (↑ ↓ → ← Quitar). */
export function MenuItemTree({ items, path = [], onMove, onIndent, onOutdent, onRemove, onPatch }: MenuItemTreeProps) {
  return (
    <div className="grid gap-2">
      {items.map((item, index) => {
        const itemPath = [...path, index];
        const key = item.id ?? itemPath.join(".");
        return (
          <div key={key} className="grid gap-2">
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
              <strong className="min-w-0 flex-1 truncate">{item.label}</strong>
              {item.invalid && <Badge variant="destructive">Enlace roto</Badge>}
              <span className="max-w-48 truncate text-sm text-muted-foreground" title={item.url ?? item.entryId}>
                {item.url ?? (item.linkType === "entry" ? item.entryId : "")}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Checkbox
                  id={`nt-${key}`}
                  aria-label={`Abrir ${item.label} en pestaña nueva`}
                  checked={item.target === "_blank"}
                  onCheckedChange={(checked) => onPatch(itemPath, { target: checked === true ? "_blank" : "_self" })}
                />
                <Label htmlFor={`nt-${key}`} className="text-xs font-normal text-muted-foreground">Pestaña nueva</Label>
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" size="icon" className="size-8" type="button" aria-label={`Subir ${item.label}`}
                  disabled={index === 0} onClick={() => onMove(itemPath, -1)}>
                  <ArrowUp />
                </Button>
                <Button variant="outline" size="icon" className="size-8" type="button" aria-label={`Bajar ${item.label}`}
                  disabled={index === items.length - 1} onClick={() => onMove(itemPath, 1)}>
                  <ArrowDown />
                </Button>
                <Button variant="outline" size="icon" className="size-8" type="button" aria-label={`Hacer ${item.label} sub-enlace del anterior`}
                  disabled={index === 0} onClick={() => onIndent(itemPath)}>
                  <ArrowRight />
                </Button>
                <Button variant="outline" size="icon" className="size-8" type="button" aria-label={`Sacar ${item.label} un nivel`}
                  disabled={path.length === 0} onClick={() => onOutdent(itemPath)}>
                  <ArrowLeft />
                </Button>
                <Button variant="outline" size="icon" className="size-8 text-destructive hover:text-destructive" type="button"
                  aria-label={`Quitar ${item.label}`} onClick={() => onRemove(itemPath)}>
                  <X />
                </Button>
              </div>
            </div>
            <AdvancedFields item={item} itemPath={itemPath} idKey={key} onPatch={onPatch} />
            {(item.children?.length ?? 0) > 0 && (
              <div className="ml-6 border-l pl-3">
                <MenuItemTree
                  items={item.children ?? []}
                  path={itemPath}
                  onMove={onMove}
                  onIndent={onIndent}
                  onOutdent={onOutdent}
                  onRemove={onRemove}
                  onPatch={onPatch}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

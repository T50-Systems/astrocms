import { useState } from "react";
import { SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { Input } from "@/components/ui/input.tsx";

export interface AddPagesPanelProps {
  pages: Array<{ id: string; title: string; slug: string; status: string }>;
  onAdd: (selection: Array<{ id: string; title: string }>) => void;
}

/** Meta-box "Páginas" estilo WordPress: buscar + checkboxes + añadir al menú en lote. */
export function AddPagesPanel({ pages, onAdd }: AddPagesPanelProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const filtered = search.trim()
    ? pages.filter((p) => p.title.toLowerCase().includes(search.trim().toLowerCase()))
    : pages;

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const add = () => {
    const chosen = pages.filter((p) => selected.has(p.id)).map((p) => ({ id: p.id, title: p.title }));
    if (chosen.length === 0) return;
    onAdd(chosen);
    setSelected(new Set());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Páginas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label htmlFor="add-pages-search" className="sr-only">Buscar páginas</label>
          <Input id="add-pages-search" placeholder="Buscar páginas…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.length === 0 && <EmptyState icon={SearchX} title="No hay páginas que coincidan." />}
          {filtered.map((page) => (
            <label key={page.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent">
              <Checkbox
                aria-label={`Seleccionar ${page.title}`}
                checked={selected.has(page.id)}
                onCheckedChange={() => toggle(page.id)}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{page.title}</span>
              {page.status !== "published" && <Badge variant="warning">Borrador</Badge>}
              <span className="max-w-40 truncate text-xs text-muted-foreground">{page.slug}</span>
            </label>
          ))}
        </div>
        <Button variant="outline" type="button" onClick={add} disabled={selected.size === 0}>
          Añadir al menú{selected.size > 0 ? ` (${selected.size})` : ""}
        </Button>
      </CardContent>
    </Card>
  );
}

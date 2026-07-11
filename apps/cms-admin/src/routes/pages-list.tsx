import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { Entry, EntryStatus } from "@astrocms/contracts";
import { cms } from "../lib.ts";
import { useSession } from "../auth.tsx";
import { Button, Empty, ErrorBox, inputStyle, Loading, Page } from "../ui.tsx";

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#fff",
  border: "1px solid #dcdcde",
};
const thStyle: CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #dcdcde",
  padding: "0.65rem",
  fontWeight: 600,
};
const tdStyle: CSSProperties = {
  borderBottom: "1px solid #f0f0f1",
  padding: "0.65rem",
  verticalAlign: "top",
};
const linkButtonStyle: CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#2271b1",
  padding: 0,
  cursor: "pointer",
  font: "inherit",
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

const previewOrigin = import.meta.env.VITE_PREVIEW_ORIGIN ?? "";

// Acciones de fila estilo WordPress: ocultas hasta hover/foco (accesibles por teclado).
const rowActionsCss = `
.wp-row-actions { opacity: 0; transition: opacity 0.1s ease; font-size: 0.82rem; margin-top: 0.35rem; color: #646970; }
tr:hover .wp-row-actions, tr:focus-within .wp-row-actions { opacity: 1; }
.wp-row-actions a, .wp-row-actions button { color: #2271b1; }
.wp-row-actions button { border: 0; background: transparent; padding: 0; cursor: pointer; font: inherit; }
.wp-row-actions .danger { color: #b32d2e; }
.wp-row-actions .sep { color: #c3c4c7; margin: 0 0.15rem; }
`;

export function PagesListPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: session, isLoading: sessionLoading } = useSession();
  const [status, setStatus] = useState<EntryStatus | undefined>();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState("");

  useEffect(() => {
    if (!sessionLoading && !session) nav({ to: "/login" });
  }, [session, sessionLoading, nav]);

  const pages = useQuery({
    queryKey: ["pages", { status, search }],
    queryFn: () =>
      cms.pages.list({
        pageSize: 50,
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      }),
    enabled: Boolean(session),
  });
  const counts = useQuery({
    queryKey: ["pages-counts"],
    queryFn: () => cms.pages.counts(),
    enabled: Boolean(session),
  });

  const pageIds = useMemo(() => pages.data?.data.map((p) => p.id) ?? [], [pages.data]);
  const allVisibleSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const invalidateLists = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["pages"] }),
      qc.invalidateQueries({ queryKey: ["pages-counts"] }),
    ]);

  const removeSelected = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => cms.pages.remove(id)));
    },
    onSuccess: async () => {
      setSelected(new Set());
      setBulkAction("");
      await invalidateLists();
    },
  });

  const removeOne = useMutation({
    mutationFn: (id: string) => cms.pages.remove(id),
    onSuccess: invalidateLists,
  });
  const duplicate = useMutation({
    mutationFn: (page: Entry) =>
      cms.pages.create({
        contentTypeKey: page.contentTypeKey,
        title: `${page.title} (copia)`,
        editorType: page.editorType,
        data: page.data,
      }),
    onSuccess: invalidateLists,
  });

  if (sessionLoading || !session) return <Page><Loading /></Page>;

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setSelected(new Set());
  };
  const toggleAll = () => {
    setSelected((current) => {
      if (pageIds.length > 0 && pageIds.every((id) => current.has(id))) return new Set();
      return new Set(pageIds);
    });
  };
  const toggleOne = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const applyBulk = () => {
    const ids = Array.from(selected);
    if (bulkAction !== "delete" || ids.length === 0) return;
    if (!window.confirm(`¿Eliminar ${ids.length} página(s) seleccionada(s)?`)) return;
    removeSelected.mutate(ids);
  };
  const setFilter = (nextStatus: EntryStatus | undefined) => {
    setStatus(nextStatus);
    setSelected(new Set());
  };

  return (
    <Page wide>
      <style>{rowActionsCss}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <h1 style={{ margin: 0 }}>Páginas</h1>
          <Button onClick={() => nav({ to: "/pages/new" })}>Añadir nueva</Button>
        </div>
        <form onSubmit={submitSearch} role="search" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label htmlFor="page-search" style={{ position: "absolute", left: "-10000px" }}>Buscar páginas</label>
          <input
            id="page-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.currentTarget.value)}
            placeholder="Buscar páginas"
            style={{ ...inputStyle, width: 240 }}
          />
          <Button type="submit" ghost>Buscar</Button>
        </form>
      </div>

      <nav aria-label="Filtros de estado" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
        <StatusFilter active={!status} label="Todas" count={counts.data?.all} onClick={() => setFilter(undefined)} />
        <span> · </span>
        <StatusFilter active={status === "published"} label="Publicadas" count={counts.data?.published} onClick={() => setFilter("published")} />
        <span> · </span>
        <StatusFilter active={status === "draft"} label="Borradores" count={counts.data?.draft} onClick={() => setFilter("draft")} />
      </nav>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
        <label htmlFor="bulk-action" style={{ position: "absolute", left: "-10000px" }}>Acciones en lote</label>
        <select
          id="bulk-action"
          value={bulkAction}
          onChange={(event) => setBulkAction(event.currentTarget.value)}
          style={{ ...inputStyle, width: 180 }}
        >
          <option value="">Acciones en lote</option>
          <option value="delete">Eliminar</option>
        </select>
        <Button type="button" ghost onClick={applyBulk} disabled={bulkAction !== "delete" || selected.size === 0 || removeSelected.isPending}>
          {removeSelected.isPending ? "Aplicando…" : "Aplicar"}
        </Button>
      </div>

      {pages.isLoading && <Loading />}
      {pages.isError && <ErrorBox error={pages.error} />}
      {counts.isError && <ErrorBox error={counts.error} />}
      {removeSelected.isError && <ErrorBox error={removeSelected.error} />}
      {removeOne.isError && <ErrorBox error={removeOne.error} />}
      {duplicate.isError && <ErrorBox error={duplicate.error} />}
      {pages.data && pages.data.data.length === 0 && (
        <Empty>{search ? "No hay páginas que coincidan con la búsqueda." : "Aún no hay páginas. Crea la primera con Añadir nueva."}</Empty>
      )}

      {pages.data && pages.data.data.length > 0 && (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th scope="col" style={{ ...thStyle, width: 44 }}>
                <input
                  type="checkbox"
                  aria-label="Seleccionar todas las páginas"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                />
              </th>
              <th scope="col" style={thStyle}>Título</th>
              <th scope="col" style={{ ...thStyle, width: 180 }}>Autor</th>
              <th scope="col" style={{ ...thStyle, width: 220 }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {pages.data.data.map((page) => (
              <tr key={page.id}>
                <td style={tdStyle}>
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${page.title}`}
                    checked={selected.has(page.id)}
                    onChange={() => toggleOne(page.id)}
                  />
                </td>
                <td style={tdStyle}>
                  <Link to="/pages/$pageId" params={{ pageId: page.id }} style={{ color: "#2271b1", fontWeight: 600 }}>
                    {page.title}
                  </Link>
                  <div style={{ color: "#646970", fontSize: "0.82rem", marginTop: "0.15rem" }}>{page.slug}</div>
                  <div className="wp-row-actions">
                    <Link to="/pages/$pageId" params={{ pageId: page.id }}>Editar</Link>
                    {page.editorType === "builder" && (
                      <>
                        <span className="sep">|</span>
                        <Link to="/pages/$pageId/builder" params={{ pageId: page.id }}>Editar visual</Link>
                      </>
                    )}
                    <span className="sep">|</span>
                    <button type="button" onClick={() => duplicate.mutate(page)} disabled={duplicate.isPending}>Duplicar</button>
                    {page.status === "published" && previewOrigin && (
                      <>
                        <span className="sep">|</span>
                        <a href={`${previewOrigin}${page.slug}`} target="_blank" rel="noreferrer">Ver</a>
                      </>
                    )}
                    <span className="sep">|</span>
                    <button
                      type="button"
                      className="danger"
                      disabled={removeOne.isPending}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar "${page.title}"?`)) removeOne.mutate(page.id);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
                <td style={tdStyle}>{page.authorName ?? "—"}</td>
                <td style={tdStyle}>
                  <div>{formatDate(page.updatedAt)}</div>
                  <div style={{ color: "#646970", fontSize: "0.82rem" }}>{page.status}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  );
}

function StatusFilter({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...linkButtonStyle, fontWeight: active ? 700 : 400 }}
    >
      {label} ({count ?? 0})
    </button>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

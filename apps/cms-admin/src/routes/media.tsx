import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import type { MediaAsset } from "@astrocms/contracts";
import { cms } from "../lib.ts";
import { Button, Empty, ErrorBox, Loading, Page } from "../ui.tsx";

const ALL = "__all__";
const NONE = "__none__"; // "sin carpeta" como destino al mover

function thumbUrl(asset: MediaAsset): string {
  return asset.variants.find((v) => v.kind === "thumb")?.url ?? asset.url;
}
function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
const dateFmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });
function fmtDate(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : dateFmt.format(d);
}

const toolbarBtn: CSSProperties = {
  border: "1px solid #c3c4c7",
  background: "#fff",
  cursor: "pointer",
  padding: "0.35rem 0.55rem",
  fontSize: "1rem",
  lineHeight: 1,
};
const searchInput: CSSProperties = { padding: "0.4rem 0.5rem", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.85rem", background: "#fff" };
const moveSelect: CSSProperties = { ...searchInput, padding: "0.2rem 0.3rem", fontSize: "0.78rem", maxWidth: "10rem" };

const folderBtn = (active: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.4rem",
  width: "100%",
  textAlign: "left",
  border: 0,
  borderRadius: 6,
  background: active ? "#2271b1" : "transparent",
  color: active ? "#fff" : "#1a1a1a",
  cursor: "pointer",
  padding: "0.45rem 0.6rem",
  fontSize: "0.88rem",
});

export function MediaPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"grid" | "list">(() => (localStorage.getItem("media-view") === "list" ? "list" : "grid"));
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [folder, setFolder] = useState<string>(ALL); // ALL o nombre de carpeta
  const [localFolders, setLocalFolders] = useState<string[]>([]); // carpetas recién creadas (aún vacías)
  const inputRef = useRef<HTMLInputElement>(null);

  const chooseView = (v: "grid" | "list") => {
    setView(v);
    localStorage.setItem("media-view", v);
  };

  const media = useQuery({
    queryKey: ["media", term, folder],
    queryFn: () =>
      cms.media.list({
        ...(term ? { search: term } : {}),
        ...(folder !== ALL ? { folder } : {}),
        page: 1,
        pageSize: 60,
      }),
  });
  const foldersQ = useQuery({ queryKey: ["media-folders"], queryFn: () => cms.media.folders() });

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["media"] }),
      qc.invalidateQueries({ queryKey: ["media-folders"] }),
    ]);

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const target = folder !== ALL ? folder : undefined;
      for (const file of files) await cms.media.upload(file, target ? { folder: target } : undefined);
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => cms.media.remove(id), onSuccess: invalidate });
  const move = useMutation({
    mutationFn: ({ id, folder: f }: { id: string; folder: string | null }) => cms.media.update(id, { folder: f }),
    onSuccess: invalidate,
  });

  // Carpetas conocidas = las del servidor + las creadas localmente (aún sin archivos).
  const folders = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of foldersQ.data ?? []) map.set(f.name, f.count);
    for (const f of localFolders) if (!map.has(f)) map.set(f, 0);
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [foldersQ.data, localFolders]);
  const folderNames = folders.map((f) => f.name);

  const handleFiles = (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (files.length) upload.mutate(files);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };
  const newFolder = () => {
    const name = window.prompt("Nombre de la nueva carpeta")?.trim();
    if (!name) return;
    if (!folderNames.includes(name)) setLocalFolders((prev) => [...prev, name]);
    setFolder(name); // entra en la carpeta: las subidas irán aquí
    setShowUpload(true);
  };

  const items = media.data?.data ?? [];

  return (
    <Page wide>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.25rem" }}>
        <h1 style={{ margin: 0 }}>Medios</h1>
        <Button onClick={() => setShowUpload((s) => !s)} aria-expanded={showUpload}>Añadir archivo</Button>
      </div>
      <p style={{ color: "#666", marginTop: 0 }}>Sube y organiza las imágenes de tu sitio.</p>

      {/* Navegación tipo carpeta + área de contenido */}
      <div style={{ display: "grid", gridTemplateColumns: "210px minmax(0, 1fr)", gap: "1.25rem", alignItems: "start" }}>
        <nav aria-label="Carpetas" style={{ border: "1px solid #dcdcde", borderRadius: 8, background: "#fff", padding: "0.5rem", display: "flex", flexDirection: "column", gap: 2 }}>
          <button type="button" style={folderBtn(folder === ALL)} aria-current={folder === ALL} onClick={() => setFolder(ALL)}>
            <span>🗂️ Todos los medios</span>
          </button>
          {folders.map((f) => (
            <button key={f.name} type="button" style={folderBtn(folder === f.name)} aria-current={folder === f.name} onClick={() => setFolder(f.name)}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📁 {f.name}</span>
              <span style={{ opacity: 0.75, fontSize: "0.78rem" }}>{f.count}</span>
            </button>
          ))}
          <button type="button" onClick={newFolder} style={{ ...folderBtn(false), color: "#2271b1", marginTop: 4, borderTop: "1px solid #f0f0f1", borderRadius: 0, paddingTop: "0.6rem" }}>
            <span>➕ Nueva carpeta</span>
          </button>
        </nav>

        <div style={{ minWidth: 0 }}>
          {/* Zona de subida: sólo visible al pulsar "Añadir archivo" */}
          {showUpload && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={{
                border: `2px dashed ${dragOver ? "#2271b1" : "#c3c4c7"}`,
                background: dragOver ? "#f0f6fc" : "#fff",
                borderRadius: 8,
                padding: "1.5rem 1rem",
                textAlign: "center",
                marginBottom: "1rem",
              }}
            >
              <p style={{ fontSize: "1.05rem", margin: "0 0 0.6rem" }}>Arrastra archivos aquí para subirlos</p>
              <p style={{ color: "#666", margin: "0 0 0.9rem" }}>o</p>
              <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
              <Button type="button" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
                {upload.isPending ? "Subiendo…" : "Seleccionar archivos"}
              </Button>
              <p style={{ color: "#999", fontSize: "0.8rem", marginTop: "0.9rem" }}>
                Imágenes JPG, PNG, WebP o GIF.
                {folder !== ALL && <> Se subirán a <strong>{folder}</strong>.</>}
              </p>
            </div>
          )}

          {upload.isError && <ErrorBox error={upload.error} />}
          {remove.isError && <ErrorBox error={remove.error} />}
          {move.isError && <ErrorBox error={move.error} />}

          {/* Cabecera: carpeta actual + vista + buscar */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.9rem", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{folder === ALL ? "Todos los medios" : `📁 ${folder}`}</h2>
            <div style={{ display: "flex", marginLeft: "0.5rem" }} role="group" aria-label="Modo de vista">
              <button type="button" onClick={() => chooseView("list")} aria-pressed={view === "list"} title="Vista de lista"
                style={{ ...toolbarBtn, borderRadius: "6px 0 0 6px", background: view === "list" ? "#2271b1" : "#fff", color: view === "list" ? "#fff" : "#1a1a1a" }}>☰</button>
              <button type="button" onClick={() => chooseView("grid")} aria-pressed={view === "grid"} title="Vista de cuadrícula"
                style={{ ...toolbarBtn, borderRadius: "0 6px 6px 0", borderLeft: 0, background: view === "grid" ? "#2271b1" : "#fff", color: view === "grid" ? "#fff" : "#1a1a1a" }}>▦</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setTerm(search.trim()); }} style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
              <label htmlFor="media-search" style={{ position: "absolute", left: "-9999px" }}>Buscar medios</label>
              <input id="media-search" placeholder="Buscar medios" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ ...searchInput, width: "13rem", maxWidth: "45vw" }} />
              <Button ghost type="submit">Buscar</Button>
            </form>
          </div>

          {media.isLoading && <Loading />}
          {media.isError && <ErrorBox error={media.error} />}
          {media.data && items.length === 0 && (
            <Empty>{term ? "No hay medios que coincidan con la búsqueda." : folder !== ALL ? "Esta carpeta está vacía." : "No hay medios todavía. Sube el primero con Añadir archivo."}</Empty>
          )}

          {media.data && items.length > 0 && view === "grid" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.8rem" }}>
              {items.map((asset) => (
                <figure key={asset.id} style={{ margin: 0, border: "1px solid #dcdcde", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <div style={{ position: "relative", aspectRatio: "1 / 1", background: "#f6f7f7" }}>
                    <img src={thumbUrl(asset)} alt={asset.alt ?? asset.filename} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <button type="button" aria-label={`Eliminar ${asset.filename}`} disabled={remove.isPending}
                      onClick={() => { if (window.confirm(`¿Eliminar "${asset.filename}"?`)) remove.mutate(asset.id); }}
                      style={{ position: "absolute", top: 4, right: 4, border: 0, borderRadius: 4, background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", padding: "2px 7px" }}>×</button>
                    {asset.folder && folder === ALL && (
                      <span style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "0.7rem", padding: "1px 6px", borderRadius: 4 }}>📁 {asset.folder}</span>
                    )}
                  </div>
                  <figcaption style={{ padding: "0.4rem 0.5rem", fontSize: "0.75rem" }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={asset.filename}>{asset.filename}</div>
                    <div style={{ color: "#888" }}>{humanBytes(asset.bytes)}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {media.data && items.length > 0 && view === "list" && (
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #dcdcde" }}>
              <thead>
                <tr>
                  <th scope="col" style={thCell}>Archivo</th>
                  <th scope="col" style={{ ...thCell, width: 170 }}>Carpeta</th>
                  <th scope="col" style={{ ...thCell, width: 90 }}>Tamaño</th>
                  <th scope="col" style={{ ...thCell, width: 120 }}>Fecha</th>
                  <th scope="col" style={{ ...thCell, width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((asset) => (
                  <tr key={asset.id}>
                    <td style={tdCell}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
                        <img src={thumbUrl(asset)} alt={asset.alt ?? asset.filename} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, background: "#f6f7f7", flexShrink: 0 }} />
                        <span style={{ display: "inline-block", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }} title={asset.filename}>{asset.filename}</span>
                      </div>
                    </td>
                    <td style={tdCell}>
                      <label htmlFor={`move-${asset.id}`} style={{ position: "absolute", left: "-9999px" }}>Mover {asset.filename} de carpeta</label>
                      <select id={`move-${asset.id}`} value={asset.folder ?? NONE} disabled={move.isPending}
                        onChange={(e) => move.mutate({ id: asset.id, folder: e.target.value === NONE ? null : e.target.value })} style={moveSelect}>
                        <option value={NONE}>— sin carpeta —</option>
                        {folderNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={tdCell}>{humanBytes(asset.bytes)}</td>
                    <td style={tdCell}>{fmtDate(asset.createdAt)}</td>
                    <td style={tdCell}>
                      <button type="button" disabled={remove.isPending}
                        onClick={() => { if (window.confirm(`¿Eliminar "${asset.filename}"?`)) remove.mutate(asset.id); }}
                        style={{ border: 0, background: "transparent", color: "#b32d2e", cursor: "pointer" }}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Page>
  );
}

const thCell: CSSProperties = { textAlign: "left", borderBottom: "1px solid #dcdcde", padding: "0.6rem", fontWeight: 600, fontSize: "0.85rem" };
const tdCell: CSSProperties = { borderBottom: "1px solid #f0f0f1", padding: "0.6rem", fontSize: "0.85rem", verticalAlign: "middle" };

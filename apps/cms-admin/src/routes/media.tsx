import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { DragEvent } from "react";
import type { MediaAsset } from "@astrocms/contracts";
import { cms } from "../lib.ts";
import { Button, Empty, ErrorBox, Loading, Page } from "../ui.tsx";

function thumbUrl(asset: MediaAsset): string {
  return asset.variants.find((v) => v.kind === "thumb")?.url ?? asset.url;
}

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const media = useQuery({
    queryKey: ["media", term],
    queryFn: () => cms.media.list({ ...(term ? { search: term } : {}), page: 1, pageSize: 60 }),
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) await cms.media.upload(file);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => cms.media.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });

  const handleFiles = (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (files.length) upload.mutate(files);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const items = media.data?.data ?? [];

  return (
    <Page wide>
      <h1>Medios</h1>
      <p style={{ color: "#666", marginTop: "-0.5rem" }}>Sube y gestiona las imágenes de tu sitio.</p>

      {/* Zona de subida (arrastrar o seleccionar) */}
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
          padding: "2rem 1rem",
          textAlign: "center",
          marginBottom: "1.25rem",
        }}
      >
        <p style={{ fontSize: "1.05rem", margin: "0 0 0.6rem" }}>Arrastra archivos aquí para subirlos</p>
        <p style={{ color: "#666", margin: "0 0 0.9rem" }}>o</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button type="button" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
          {upload.isPending ? "Subiendo…" : "Seleccionar archivos"}
        </Button>
        <p style={{ color: "#999", fontSize: "0.8rem", marginTop: "0.9rem" }}>
          Imágenes JPG, PNG, WebP o GIF. Se generan miniaturas automáticamente.
        </p>
      </div>

      {upload.isError && <ErrorBox error={upload.error} />}
      {remove.isError && <ErrorBox error={remove.error} />}

      {/* Buscador */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(search.trim());
        }}
        style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginBottom: "1rem" }}
      >
        <label htmlFor="media-search" style={{ position: "absolute", left: "-9999px" }}>
          Buscar medios
        </label>
        <input
          id="media-search"
          placeholder="Buscar medios"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "0.5rem 0.7rem", borderRadius: 6, border: "1px solid #ccc", width: "16rem", maxWidth: "60%" }}
        />
        <Button ghost type="submit">Buscar</Button>
      </form>

      {media.isLoading && <Loading />}
      {media.isError && <ErrorBox error={media.error} />}
      {media.data && items.length === 0 && <Empty>No hay medios todavía. Sube el primero arriba.</Empty>}

      {/* Cuadrícula */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.8rem" }}>
        {items.map((asset) => (
          <figure key={asset.id} style={{ margin: 0, border: "1px solid #dcdcde", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
            <div style={{ position: "relative", aspectRatio: "1 / 1", background: "#f6f7f7" }}>
              <img
                src={thumbUrl(asset)}
                alt={asset.alt ?? asset.filename}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              <button
                type="button"
                aria-label={`Eliminar ${asset.filename}`}
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`¿Eliminar "${asset.filename}"?`)) remove.mutate(asset.id);
                }}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  border: 0,
                  borderRadius: 4,
                  background: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  cursor: "pointer",
                  padding: "2px 7px",
                }}
              >
                ×
              </button>
            </div>
            <figcaption style={{ padding: "0.4rem 0.5rem", fontSize: "0.75rem" }}>
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={asset.filename}>
                {asset.filename}
              </div>
              <div style={{ color: "#888" }}>{humanBytes(asset.bytes)}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </Page>
  );
}

import { useEffect, useRef, useState } from "react";
import type { MediaAsset } from "@astrocms/contracts";
import { useBuilder } from "./provider.js";
import { colors, styles } from "./styles.js";

export interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
}

function thumbUrl(asset: MediaAsset) {
  return asset.variants.find((variant) => variant.kind === "thumb")?.url ?? asset.url;
}

export function MediaPicker({ open, onClose, onSelect }: MediaPickerProps) {
  const { cms } = useBuilder();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchInput.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !cms) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      cms.media.list({ page: 1, pageSize: 50, ...(search ? { search } : {}) })
        .then((page) => {
          if (active) setAssets(page.data);
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : "No se pudo cargar la biblioteca");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, search ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cms, open, search]);

  if (!open) return null;

  return (
    <div
      aria-label="Biblioteca de medios"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      style={{ position: "fixed", inset: 0, zIndex: 20, display: "grid", placeItems: "center", padding: 20, background: "rgb(23 32 51 / 45%)" }}
    >
      <div style={{ width: "min(720px, 100%)", maxHeight: "min(720px, 100%)", overflow: "auto", padding: 16, borderRadius: 8, background: colors.surface, boxShadow: "0 12px 32px rgb(23 32 51 / 25%)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <strong>Biblioteca</strong>
          <button type="button" style={styles.button} onClick={onClose}>Cerrar</button>
        </div>
        {!cms ? <p style={{ color: colors.muted }}>Biblioteca no disponible.</p> : <>
          <input ref={searchInput} aria-label="Buscar medios" placeholder="Buscar medios" style={{ ...styles.input, marginBottom: 12 }} value={search} onChange={(event) => setSearch(event.target.value)} />
          {loading && <p style={{ color: colors.muted }}>Cargando…</p>}
          {error && <p style={{ color: colors.danger }}>{error}</p>}
          {!loading && !error && assets.length === 0 && <p style={{ color: colors.muted }}>No hay medios. Súbelos en la sección Medios.</p>}
          {!error && assets.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: 12 }}>
            {assets.map((asset) => <button key={asset.id} type="button" aria-label={`Elegir ${asset.alt ?? asset.filename}`} onClick={() => { onSelect(asset); onClose(); }} style={{ display: "grid", gap: 6, minWidth: 0, padding: 0, border: 0, background: "transparent", color: colors.text, textAlign: "left", cursor: "pointer" }}>
              <img src={thumbUrl(asset)} alt={asset.alt ?? asset.filename} loading="lazy" style={{ width: "100%", height: 108, borderRadius: 6, objectFit: "cover", background: colors.subtle }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{asset.alt ?? asset.filename}</span>
            </button>)}
          </div>}
        </>}
      </div>
    </div>
  );
}

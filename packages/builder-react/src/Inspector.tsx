import { useEffect, useState } from "react";
import { findNode } from "@astrocms/builder-core";
import type { MediaAsset, SerializedField } from "@astrocms/contracts";
import { useBuilder } from "./provider.js";
import { getBlock, isMediaRef, optionList, valueAt } from "./utils.js";
import { colors, styles } from "./styles.js";

export function Inspector() {
  const { engine, manifest, state } = useBuilder();
  const node = state.selectedNodeId ? findNode(state.document.root, state.selectedNodeId) : undefined;
  const block = node ? getBlock(manifest, node.type) : undefined;

  if (!node || !block) {
    return (
      <div style={styles.panel}>
        <h2 style={styles.title}>Inspector</h2>
        <p style={{ color: colors.muted, fontSize: 13 }}>Selecciona un nodo para editar sus propiedades.</p>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <h2 style={styles.title}>{block.label}</h2>
      <p style={{ color: colors.muted, fontSize: 12, marginTop: 0 }}>{node.type}</p>
      <div style={{ display: "grid", gap: 12 }}>
        {block.fields.map((field) => (
          <FieldEditor key={field.key} field={field} nodeId={node.id} value={valueAt(node, field)} />
        ))}
      </div>
    </div>
  );
}

function FieldEditor({ field, nodeId, value }: { field: SerializedField; nodeId: string; value: unknown }) {
  const { engine } = useBuilder();
  const path = `props.${field.key}`;
  const id = `${nodeId}-${field.key}`;
  const set = (next: unknown) => engine.dispatch({ kind: "setProp", nodeId, path, value: next });

  return (
    <label htmlFor={id} style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 600 }}>
      {field.label}
      {field.type === "textarea" ? (
        <textarea id={id} rows={4} style={styles.input} value={typeof value === "string" ? value : ""} onChange={(event) => set(event.target.value)} />
      ) : field.type === "number" ? (
        <input id={id} type="number" style={styles.input} value={typeof value === "number" ? value : 0} onChange={(event) => set(event.target.valueAsNumber)} />
      ) : field.type === "boolean" ? (
        <input id={id} type="checkbox" checked={value === true} onChange={(event) => set(event.target.checked)} style={{ justifySelf: "start" }} />
      ) : field.type === "select" ? (
        <select id={id} style={styles.input} value={typeof value === "string" ? value : ""} onChange={(event) => set(event.target.value)}>
          {optionList(field).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : field.type === "media" ? (
        <MediaField id={id} value={value} onChange={set} />
      ) : (
        <input id={id} style={styles.input} value={typeof value === "string" ? value : ""} onChange={(event) => set(event.target.value)} />
      )}
    </label>
  );
}

function MediaField({ id, value, onChange }: { id: string; value: unknown; onChange: (value: unknown) => void }) {
  const { cms } = useBuilder();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [error, setError] = useState<string>("");
  const selected = isMediaRef(value) ? value.assetId : "";

  useEffect(() => {
    if (!cms) return;
    let active = true;
    cms.media.list({ page: 1, pageSize: 50 })
      .then((page) => {
        if (active) setAssets(page.data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "No se pudo cargar media");
      });
    return () => {
      active = false;
    };
  }, [cms]);

  if (!cms) return <input id={id} style={styles.input} value={selected} onChange={(event) => onChange({ kind: "media", assetId: event.target.value })} />;

  return (
    <>
      <select
        id={id}
        style={styles.input}
        value={selected}
        onChange={(event) => onChange(event.target.value ? { kind: "media", assetId: event.target.value } : undefined)}
      >
        <option value="">Sin media</option>
        {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.alt ?? asset.filename}</option>)}
      </select>
      {error && <span style={{ color: colors.danger, fontSize: 12 }}>{error}</span>}
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { envelopeSchema, guestMessageSchema, PROTOCOL_VERSION, type HostMessage } from "@astrocms/contracts";
import { useBuilder } from "./provider.js";
import { allNodeIds } from "./utils.js";
import { colors, styles } from "./styles.js";

export function BuilderCanvas() {
  const { engine, manifest, previewOrigin, previewToken, channelId, state } = useBuilder();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const targetOrigin = useMemo(() => new URL(previewOrigin).origin, [previewOrigin]);
  const src = useMemo(() => {
    const url = new URL(`/builder-preview/${state.document.id}`, previewOrigin);
    url.searchParams.set("channelId", channelId);
    if (previewToken) url.searchParams.set("token", previewToken);
    return url.toString();
  }, [channelId, previewOrigin, previewToken, state.document.id]);

  function post(message: HostMessage) {
    const target = frameRef.current?.contentWindow;
    if (!target) return;
    target.postMessage({ protocol: PROTOCOL_VERSION, channelId, source: "host", message }, targetOrigin);
  }

  useEffect(() => {
    function onMessage(event: MessageEvent<unknown>) {
      if (event.origin !== targetOrigin) return;
      const parsed = envelopeSchema.safeParse(event.data);
      if (!parsed.success || parsed.data.channelId !== channelId || parsed.data.source !== "guest") return;
      const guest = guestMessageSchema.safeParse(parsed.data.message);
      if (!guest.success) return;
      const message = guest.data;
      if (message.type === "guest/preview-ready") {
        setReady(true);
        setPreviewError(null);
        post({ type: "host/ready", manifestVersion: manifest.schemaVersion });
        post({ type: "host/document-updated", document: state.document });
        post({ type: "host/select-node", nodeId: state.selectedNodeId });
      } else if (message.type === "guest/node-selected") {
        engine.select(message.nodeId);
      } else if (message.type === "guest/inline-edit") {
        engine.dispatch({ kind: "setProp", nodeId: message.nodeId, path: message.path, value: message.value });
      } else if (message.type === "guest/preview-error") {
        setPreviewError(message.nodeId ? `${message.message} (nodo ${message.nodeId})` : message.message);
      } else if (message.type === "guest/schema-mismatch") {
        setPreviewError(
          `Bloque "${message.blockType}": el preview espera la versión ${message.expected} del esquema pero encontró ${message.found} (nodo ${message.nodeId}). Vuelve a guardar la página para regenerar el preview.`,
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [channelId, engine, manifest.schemaVersion, state.document, state.selectedNodeId, targetOrigin]);

  useEffect(() => {
    if (ready) post({ type: "host/document-updated", document: state.document });
    // Limpieza optimista: los mensajes guest de error no llevan versión de documento, así que no se pueden correlacionar con el render actual. La corrección (token de versión en el contrato) va junto al emisor del guest, aún no implementado.
    setPreviewError(null);
  }, [ready, state.document]);

  useEffect(() => {
    if (ready) post({ type: "host/select-node", nodeId: state.selectedNodeId });
  }, [ready, state.selectedNodeId]);

  useEffect(() => {
    if (ready) post({ type: "host/set-breakpoint", breakpoint: state.breakpoint });
  }, [ready, state.breakpoint]);

  const chipStyle = {
    background: colors.subtle,
    border: `1px solid ${colors.border}`,
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 12,
    color: colors.muted,
  };

  const errorBannerStyle = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    background: "color-mix(in oklch, var(--destructive, #b42318) 12%, transparent)",
    border: "1px solid color-mix(in oklch, var(--destructive, #b42318) 40%, transparent)",
    color: colors.danger,
    borderRadius: "var(--radius, 10px)",
    padding: "6px 10px",
    fontSize: 12,
  };

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateRows: previewError ? "auto auto 1fr" : "auto 1fr",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={chipStyle}>{ready ? "Preview conectado" : "Esperando preview..."}</span>
        <span style={chipStyle}>{allNodeIds(state.document.root).length} nodos</span>
      </div>
      {previewError ? (
        <div role="alert" style={errorBannerStyle}>
          <span style={{ whiteSpace: "normal" }}>{previewError}</span>
          <button
            type="button"
            aria-label="Descartar error"
            onClick={() => setPreviewError(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>
      ) : null}
      <iframe ref={frameRef} title="Builder preview" src={src} style={styles.iframe} />
    </div>
  );
}

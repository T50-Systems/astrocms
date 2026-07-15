import { useEffect, useMemo, useRef, useState } from "react";
import {
  envelopeSchema,
  guestMessageSchema,
  PROTOCOL_VERSION,
  type BuilderNode,
  type HostMessage,
} from "@astrocms/contracts";
import { useBuilder } from "./provider.js";
import { allNodeIds } from "./utils.js";
import { colors, styles } from "./styles.js";

function structureSignature(node: BuilderNode): string {
  return `${node.id}${node.type}${node.hidden ? 1 : 0}[${node.children.map(structureSignature).join("")}]`;
}

export function BuilderCanvas() {
  const { engine, manifest, previewOrigin, previewToken, channelId, state, previewReloadNonce } = useBuilder();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const renderTokenRef = useRef(0);
  const lastLoadedSigRef = useRef<string | null>(null);
  if (lastLoadedSigRef.current === null) {
    lastLoadedSigRef.current = structureSignature(state.document.root);
  }
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
        setPreviewErrors([]);
        const blockVersions = Object.fromEntries(manifest.blocks.map((b) => [b.type, b.version]));
        post({ type: "host/ready", manifestVersion: manifest.schemaVersion, blockVersions });
        post({ type: "host/select-node", nodeId: state.selectedNodeId });
      } else if (message.type === "guest/node-selected") {
        engine.select(message.nodeId);
      } else if (message.type === "guest/inline-edit") {
        engine.dispatch({ kind: "setProp", nodeId: message.nodeId, path: message.path, value: message.value });
      } else if (message.type === "guest/preview-error") {
        if (message.renderToken !== renderTokenRef.current) return; // error obsoleto
        setPreviewErrors((prev) => [...prev, message.nodeId ? `${message.message} (nodo ${message.nodeId})` : message.message]);
      } else if (message.type === "guest/schema-mismatch") {
        if (message.renderToken !== renderTokenRef.current) return; // error obsoleto
        setPreviewErrors((prev) => [
          ...prev,
          `Bloque "${message.blockType}": el preview espera la versión ${message.expected} del esquema pero encontró ${message.found} (nodo ${message.nodeId}). Vuelve a guardar la página para regenerar el preview.`,
        ]);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [channelId, engine, manifest.schemaVersion, state.document, state.selectedNodeId, targetOrigin]);

  useEffect(() => {
    if (!ready) return;
    renderTokenRef.current += 1;
    post({ type: "host/document-updated", document: state.document, renderToken: renderTokenRef.current });
    setPreviewErrors([]);
  }, [ready, state.document]);

  useEffect(() => {
    if (!ready || previewReloadNonce === 0) return;
    const sig = structureSignature(state.document.root);
    if (sig !== lastLoadedSigRef.current) {
      lastLoadedSigRef.current = sig;
      setReady(false);
      post({ type: "host/reload-preview" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el disparo debe ser SOLO previewReloadNonce; ready/state.document se leen por closure con el valor fresco del render en curso.
  }, [previewReloadNonce]);

  useEffect(() => {
    if (ready) post({ type: "host/select-node", nodeId: state.selectedNodeId });
  }, [ready, state.selectedNodeId]);

  useEffect(() => {
    if (ready) post({ type: "host/set-breakpoint", breakpoint: state.breakpoint });
  }, [ready, state.breakpoint]);

  const frameWidth = manifest.tokens.breakpoints.find((b) => b.name === state.breakpoint)?.width; // number | undefined (undefined = completo)

  const chipStyle = {
    background: colors.subtle,
    border: `1px solid ${colors.border}`,
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 12,
    color: colors.text,
  };

  const errorBannerStyle = {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "stretch",
    gap: 4,
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
        gridTemplateRows: previewErrors.length > 0 ? "auto auto 1fr" : "auto 1fr",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={chipStyle}>{ready ? "Preview conectado" : "Esperando preview..."}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {frameWidth ? <span style={chipStyle}>{frameWidth}px</span> : null}
          <span style={chipStyle}>{allNodeIds(state.document.root).length} nodos</span>
        </div>
      </div>
      {previewErrors.length > 0 ? (
        <div role="alert" style={errorBannerStyle}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <span style={{ whiteSpace: "normal" }}>
              {previewErrors.length > 1 ? `${previewErrors.length} problemas de preview:` : previewErrors[0]}
            </span>
            <button
              type="button"
              aria-label="Descartar error"
              onClick={() => setPreviewErrors([])}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
          {previewErrors.length > 1 ? (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {previewErrors.map((error, index) => (
                <li key={index} style={{ whiteSpace: "normal" }}>
                  {error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <iframe
        ref={frameRef}
        title="Builder preview"
        src={src}
        style={{
          ...styles.iframe,
          width: frameWidth ? `${frameWidth}px` : "100%",
          maxWidth: "100%",
          justifySelf: "center",
          transition: "width 200ms var(--ease-standard, ease)",
        }}
      />
    </div>
  );
}

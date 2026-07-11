import { useEffect, useMemo, useRef, useState } from "react";
import { envelopeSchema, guestMessageSchema, PROTOCOL_VERSION, type HostMessage } from "@astrocms/contracts";
import { useBuilder } from "./provider.js";
import { allNodeIds } from "./utils.js";
import { colors, styles } from "./styles.js";

export function BuilderCanvas() {
  const { engine, manifest, previewOrigin, previewToken, channelId, state } = useBuilder();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
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
        post({ type: "host/ready", manifestVersion: manifest.schemaVersion });
        post({ type: "host/document-updated", document: state.document });
        post({ type: "host/select-node", nodeId: state.selectedNodeId });
      } else if (message.type === "guest/node-selected") {
        engine.select(message.nodeId);
      } else if (message.type === "guest/inline-edit") {
        engine.dispatch({ kind: "setProp", nodeId: message.nodeId, path: message.path, value: message.value });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [channelId, engine, manifest.schemaVersion, state.document, state.selectedNodeId, targetOrigin]);

  useEffect(() => {
    if (ready) post({ type: "host/document-updated", document: state.document });
  }, [ready, state.document]);

  useEffect(() => {
    if (ready) post({ type: "host/select-node", nodeId: state.selectedNodeId });
  }, [ready, state.selectedNodeId]);

  useEffect(() => {
    if (ready) post({ type: "host/set-breakpoint", breakpoint: state.breakpoint });
  }, [ready, state.breakpoint]);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: colors.muted, fontSize: 12 }}>
        <span>{ready ? "Preview conectado" : "Esperando preview..."}</span>
        <span>{allNodeIds(state.document.root).length} nodos</span>
      </div>
      <iframe ref={frameRef} title="Builder preview" src={src} style={styles.iframe} />
    </div>
  );
}

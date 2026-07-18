import { useCallback, useEffect, useRef, useState } from "react";
import { findNode } from "@astrocms/builder-core";
import { useBuilder } from "./provider.js";
import { colors, disabledStyle, styles } from "./styles.js";
import { getBlock } from "./utils.js";

type Phase = "idle" | "saving" | "saved" | "publishing" | "published" | "error";

export function Toolbar() {
  const { engine, manifest, state, onSave, onPublish, documentTitle, onExit, onRenameDocument, requestPreviewReload, viewMode, setViewMode } = useBuilder();
  const savedDocumentRef = useRef(state.document);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [titleDraft, setTitleDraft] = useState(documentTitle ?? "");
  const titleFocusedRef = useRef(false);
  const busy = phase === "saving" || phase === "publishing";
  const dirty = state.document !== savedDocumentRef.current;

  useEffect(() => {
    if (!titleFocusedRef.current) setTitleDraft(documentTitle ?? "");
  }, [documentTitle]);

  const commitTitle = async () => {
    titleFocusedRef.current = false;
    const t = titleDraft.trim();
    if (!onRenameDocument || !t || t === documentTitle) {
      setTitleDraft(documentTitle ?? ""); // vacío o sin cambio → vuelve al título actual
      return;
    }
    try {
      await onRenameDocument(t);
    } catch (err) {
      setTitleDraft(documentTitle ?? ""); // revierte al fallar
      setErrorMessage(err instanceof Error ? err.message : "No se pudo renombrar la página.");
      setPhase("error");
    }
  };

  const save = useCallback(async () => {
    setPhase("saving");
    try {
      await onSave(state.document);
      savedDocumentRef.current = state.document;
      setPhase("saved");
      requestPreviewReload();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error inesperado al guardar");
      setPhase("error");
    }
  }, [onSave, requestPreviewReload, state.document]);

  const publish = useCallback(async () => {
    setPhase("publishing");
    try {
      await onPublish(state.document);
      savedDocumentRef.current = state.document;
      setPhase("published");
      requestPreviewReload();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error inesperado al publicar");
      setPhase("error");
    }
  }, [onPublish, requestPreviewReload, state.document]);

  // Refs con el último valor para que el listener de teclado no quede con closures obsoletas.
  const saveRef = useRef(save);
  saveRef.current = save;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const ctxRef = useRef({ state, manifest });
  ctxRef.current = { state, manifest };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === "s") {
        event.preventDefault();
        if (!busyRef.current) void saveRef.current();
        return;
      }

      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isEditableTarget) return;

      if (mod && key === "z" && event.shiftKey) {
        event.preventDefault();
        engine.redo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        engine.redo();
        return;
      }
      if (mod && key === "z") {
        event.preventDefault();
        engine.undo();
        return;
      }

      const { state, manifest } = ctxRef.current;
      const selectedId = state.selectedNodeId;
      const selectedNode = selectedId ? findNode(state.document.root, selectedId) : undefined;
      const caps = selectedNode ? getBlock(manifest, selectedNode.type)?.capabilities : undefined;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (selectedNode && caps?.removable && !selectedNode.locked) {
          engine.dispatch({ kind: "removeNode", nodeId: selectedNode.id });
          engine.select(null);
        }
        return;
      }

      if (mod && key === "d") {
        event.preventDefault();
        if (selectedNode && caps?.duplicable && !selectedNode.locked) {
          engine.dispatch({ kind: "duplicateNode", nodeId: selectedNode.id });
        }
        return;
      }

      if (event.key === "Escape") {
        if (selectedId) engine.select(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [engine]);

  const status = statusOf(phase, dirty, errorMessage);

  return (
    <div style={styles.toolbar}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
        {onExit && (
          <button type="button" style={styles.button} onClick={onExit}>
            ← Volver
          </button>
        )}
        {onRenameDocument ? (
          <input
            aria-label="Título de la página"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onFocus={() => {
              titleFocusedRef.current = true;
            }}
            onBlur={() => void commitTitle()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            style={{
              fontWeight: 600,
              maxWidth: 240,
              border: "1px solid transparent",
              borderRadius: 6,
              padding: "2px 6px",
              background: "transparent",
              color: "inherit",
              fontSize: "inherit",
            }}
          />
        ) : documentTitle ? (
          <span
            title={documentTitle}
            style={{
              fontWeight: 600,
              maxWidth: 240,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {documentTitle}
          </span>
        ) : null}
        <button type="button" style={{ ...styles.button, ...disabledStyle(!engine.canUndo()) }} disabled={!engine.canUndo()} onClick={() => engine.undo()}>
          Deshacer
        </button>
        <button type="button" style={{ ...styles.button, ...disabledStyle(!engine.canRedo()) }} disabled={!engine.canRedo()} onClick={() => engine.redo()}>
          Rehacer
        </button>
        <div role="group" aria-label="Modo de vista" style={styles.segmentedControl}>
          {(["preview", "wireframe"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={viewMode === mode}
              style={{ ...styles.segmentedButton, ...(viewMode === mode ? styles.segmentedButtonActive : {}) }}
              onClick={() => setViewMode(mode)}
            >
              {mode === "preview" ? "Preview" : "Wireframe"}
            </button>
          ))}
        </div>
        <label htmlFor="builder-breakpoint" style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          Breakpoint
          <select
            id="builder-breakpoint"
            title={viewMode === "wireframe" ? "Solo disponible en Preview" : undefined}
            disabled={viewMode === "wireframe"}
            style={{ ...styles.input, ...disabledStyle(viewMode === "wireframe") }}
            value={state.breakpoint}
            onChange={(event) => engine.setBreakpoint(event.target.value)}
          >
            {manifest.tokens.breakpoints.map((bp) => <option key={bp.name} value={bp.name}>{bp.name}</option>)}
          </select>
        </label>
      </div>
      <div role="status" aria-live="polite" style={{ minWidth: 180, textAlign: "center", color: status.color, fontSize: 12 }}>{status.text}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={styles.button} onClick={() => void save()}>
          Guardar
        </button>
        <button
          type="button"
          style={{ ...styles.primaryButton, ...disabledStyle(busy) }}
          disabled={busy}
          onClick={() => void publish()}
        >
          Publicar
        </button>
      </div>
    </div>
  );
}

function statusOf(phase: Phase, dirty: boolean, errorMessage: string): { text: string; color: string } {
  if (phase === "saving") return { text: "Guardando…", color: colors.muted };
  if (phase === "publishing") return { text: "Publicando…", color: colors.muted };
  if (phase === "error") return { text: errorMessage, color: colors.danger };
  if (dirty) return { text: "Cambios sin guardar", color: colors.muted };
  if (phase === "saved") return { text: "Guardado ✓", color: colors.success };
  if (phase === "published") return { text: "Publicado ✓", color: colors.success };
  return { text: "", color: colors.muted };
}

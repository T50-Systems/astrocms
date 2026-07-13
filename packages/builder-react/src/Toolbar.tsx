import { useCallback, useEffect, useRef, useState } from "react";
import { useBuilder } from "./provider.js";
import { colors, disabledStyle, styles } from "./styles.js";

type Phase = "idle" | "saving" | "saved" | "publishing" | "published" | "error";

export function Toolbar() {
  const { engine, manifest, state, onSave, onPublish, documentTitle, onExit } = useBuilder();
  const savedDocumentRef = useRef(state.document);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const busy = phase === "saving" || phase === "publishing";
  const dirty = state.document !== savedDocumentRef.current;

  const save = useCallback(async () => {
    setPhase("saving");
    try {
      await onSave(state.document);
      savedDocumentRef.current = state.document;
      setPhase("saved");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error inesperado al guardar");
      setPhase("error");
    }
  }, [onSave, state.document]);

  const publish = useCallback(async () => {
    setPhase("publishing");
    try {
      await onPublish(state.document);
      savedDocumentRef.current = state.document;
      setPhase("published");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error inesperado al publicar");
      setPhase("error");
    }
  }, [onPublish, state.document]);

  // Refs con el último valor para que el listener de teclado no quede con closures obsoletas.
  const saveRef = useRef(save);
  saveRef.current = save;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();

      if (key === "s") {
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

      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        engine.redo();
      } else if (key === "y") {
        event.preventDefault();
        engine.redo();
      } else if (key === "z") {
        event.preventDefault();
        engine.undo();
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
        {documentTitle && (
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
        )}
        <button type="button" style={{ ...styles.button, ...disabledStyle(!engine.canUndo()) }} disabled={!engine.canUndo()} onClick={() => engine.undo()}>
          Deshacer
        </button>
        <button type="button" style={{ ...styles.button, ...disabledStyle(!engine.canRedo()) }} disabled={!engine.canRedo()} onClick={() => engine.redo()}>
          Rehacer
        </button>
        <label htmlFor="builder-breakpoint" style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          Breakpoint
          <select id="builder-breakpoint" style={styles.input} value={state.breakpoint} onChange={(event) => engine.setBreakpoint(event.target.value)}>
            {manifest.tokens.breakpoints.map((bp) => <option key={bp} value={bp}>{bp}</option>)}
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

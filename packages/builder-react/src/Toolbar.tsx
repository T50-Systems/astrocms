import { useState } from "react";
import { useBuilder } from "./provider.js";
import { disabledStyle, styles } from "./styles.js";

export function Toolbar() {
  const { engine, manifest, state, onSave, onPublish } = useBuilder();
  const [status, setStatus] = useState<string>("");

  async function run(label: string, action: () => Promise<void> | void) {
    setStatus(`${label}...`);
    try {
      await action();
      setStatus(`${label} listo`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error inesperado");
    }
  }

  return (
    <div style={styles.toolbar}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" style={{ ...styles.button, ...disabledStyle(!engine.canUndo()) }} disabled={!engine.canUndo()} onClick={() => engine.undo()}>
          Deshacer
        </button>
        <button type="button" style={{ ...styles.button, ...disabledStyle(!engine.canRedo()) }} disabled={!engine.canRedo()} onClick={() => engine.redo()}>
          Rehacer
        </button>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          Breakpoint
          <select style={styles.input} value={state.breakpoint} onChange={(event) => engine.setBreakpoint(event.target.value)}>
            {manifest.tokens.breakpoints.map((bp) => <option key={bp} value={bp}>{bp}</option>)}
          </select>
        </label>
      </div>
      <div style={{ minWidth: 180, textAlign: "center", color: "#667085", fontSize: 12 }}>{status}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={styles.button} onClick={() => void run("Guardando", () => onSave(state.document))}>
          Guardar
        </button>
        <button type="button" style={styles.primaryButton} onClick={() => void run("Publicando", () => onPublish(state.document))}>
          Publicar
        </button>
      </div>
    </div>
  );
}

import { BlockPanel } from "./BlockPanel.js";
import { BuilderCanvas } from "./Canvas.js";
import { Inspector } from "./Inspector.js";
import { NodeTree } from "./NodeTree.js";
import { Toolbar } from "./Toolbar.js";
import { Wireframe } from "./Wireframe.js";
import { useBuilder } from "./provider.js";
import { styles } from "./styles.js";

export function Builder() {
  const { viewMode } = useBuilder();
  return (
    <div style={styles.shell}>
      <header>
        <Toolbar />
      </header>
      <div style={styles.body}>
        <aside aria-label="Bloques y árbol del documento" style={styles.side}>
          <BlockPanel />
          <NodeTree />
        </aside>
        <section aria-label="Lienzo del builder" style={styles.canvasWrap}>
          {/* Ambas vistas SIEMPRE montadas: alternar solo cambia display, nunca desmonta el
              iframe (conserva handshake/renderToken/nonce). Caja con height:100% (no
              display:contents) para que el height:100% del canvas se resuelva bien. */}
          <div style={{ display: viewMode === "preview" ? "block" : "none", height: "100%" }}>
            <BuilderCanvas />
          </div>
          <div style={{ display: viewMode === "wireframe" ? "block" : "none", height: "100%" }}>
            <Wireframe />
          </div>
        </section>
        <aside aria-label="Inspector de propiedades" style={styles.right}>
          <Inspector />
        </aside>
      </div>
    </div>
  );
}

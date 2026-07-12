import { BlockPanel } from "./BlockPanel.js";
import { BuilderCanvas } from "./Canvas.js";
import { Inspector } from "./Inspector.js";
import { NodeTree } from "./NodeTree.js";
import { Toolbar } from "./Toolbar.js";
import { styles } from "./styles.js";

export function Builder() {
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
          <BuilderCanvas />
        </section>
        <aside aria-label="Inspector de propiedades" style={styles.right}>
          <Inspector />
        </aside>
      </div>
    </div>
  );
}

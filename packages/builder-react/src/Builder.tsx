import { BlockPanel } from "./BlockPanel.js";
import { BuilderCanvas } from "./Canvas.js";
import { Inspector } from "./Inspector.js";
import { NodeTree } from "./NodeTree.js";
import { Toolbar } from "./Toolbar.js";
import { styles } from "./styles.js";

export function Builder() {
  return (
    <div style={styles.shell}>
      <Toolbar />
      <div style={styles.body}>
        <aside style={styles.side}>
          <BlockPanel />
          <NodeTree />
        </aside>
        <main style={styles.canvasWrap}>
          <BuilderCanvas />
        </main>
        <aside style={styles.right}>
          <Inspector />
        </aside>
      </div>
    </div>
  );
}

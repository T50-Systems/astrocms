import { useState } from "react";
import { findNode } from "@astrocms/builder-core";
import { useBuilder } from "./provider.js";
import { childIndex, insertionParentId, newNode } from "./utils.js";
import { colors, styles } from "./styles.js";

export function BlockPanel() {
  const { engine, manifest, state } = useBuilder();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const filteredBlocks = needle
    ? manifest.blocks.filter((block) => block.label.toLowerCase().includes(needle) || block.type.toLowerCase().includes(needle))
    : manifest.blocks;
  const groups = filteredBlocks.reduce<Map<string, typeof manifest.blocks>>((acc, block) => {
    const blocks = acc.get(block.category) ?? [];
    blocks.push(block);
    acc.set(block.category, blocks);
    return acc;
  }, new Map());

  return (
    <div style={styles.panel}>
      <h2 style={styles.title}>Bloques</h2>
      <input
        type="search"
        style={{ ...styles.input, marginBottom: 8 }}
        placeholder="Buscar bloques…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {groups.size === 0 && <p style={{ color: colors.muted, fontSize: 13 }}>Sin resultados</p>}
      {[...groups.entries()].map(([category, blocks]) => (
        <section key={category}>
          <h3 style={styles.sectionTitle}>{category}</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {blocks.map((block) => (
              <button
                key={block.type}
                type="button"
                data-testid={`add-block-${block.type}`}
                style={{ ...styles.button, textAlign: "left" }}
                onClick={() => {
                  const parentId = insertionParentId(state.document, manifest, state.selectedNodeId, block.type);
                  const parent = findNode(state.document.root, parentId);
                  engine.dispatch({ kind: "insertNode", parentId, index: parent ? childIndex(parent) : 0, node: newNode(block) });
                }}
              >
                {block.icon ? `${block.icon} ` : ""}{block.label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

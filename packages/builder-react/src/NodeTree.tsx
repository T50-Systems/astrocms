import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BuilderNode } from "@astrocms/contracts";
import { getBlock, findMoveTarget } from "./utils.js";
import { useBuilder } from "./provider.js";
import { colors, styles } from "./styles.js";

export function NodeTree() {
  const { engine, manifest, state } = useBuilder();

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const over = event.over;
    if (!over) return;
    const target = findMoveTarget(state.document, manifest, activeId, String(over.id));
    if (!target) return;
    engine.dispatch({ kind: "moveNode", nodeId: activeId, toParentId: target.parentId, toIndex: target.index });
  }

  return (
    <div style={{ ...styles.panel, borderTop: `1px solid ${colors.border}` }}>
      <h2 style={styles.title}>Árbol</h2>
      <DndContext onDragEnd={onDragEnd}>
        <SortableContext items={state.document.root.children.map((child) => child.id)} strategy={verticalListSortingStrategy}>
          <TreeNode node={state.document.root} depth={0} />
        </SortableContext>
      </DndContext>
    </div>
  );
}

function TreeNode({ node, depth }: { node: BuilderNode; depth: number }) {
  const { engine, manifest, state } = useBuilder();
  const block = getBlock(manifest, node.type);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id, disabled: depth === 0 });
  const selected = state.selectedNodeId === node.id;
  const caps = block?.capabilities;

  return (
    <div>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.6 : 1,
          margin: "3px 0",
          paddingLeft: depth * 12,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 4,
            alignItems: "center",
            border: `1px solid ${selected ? "#93b7ff" : colors.border}`,
            background: selected ? colors.selected : node.hidden ? "#f8f8f8" : colors.surface,
            borderRadius: 6,
            padding: 5,
          }}
        >
          <button
            type="button"
            style={{ border: 0, background: "transparent", textAlign: "left", cursor: "pointer", fontSize: 13, color: colors.text }}
            onClick={() => engine.select(node.id)}
            {...attributes}
            {...listeners}
          >
            {node.hidden ? "Oculto: " : ""}{block?.label ?? node.type}
          </button>
          <div style={{ display: "flex", gap: 3 }}>
            {caps?.duplicable && <MiniButton label="Duplicar" onClick={() => engine.dispatch({ kind: "duplicateNode", nodeId: node.id })}>⧉</MiniButton>}
            {caps?.hideable && <MiniButton label={node.hidden ? "Mostrar" : "Ocultar"} onClick={() => engine.dispatch({ kind: "setHidden", nodeId: node.id, hidden: !node.hidden })}>◐</MiniButton>}
            {caps?.removable && <MiniButton label="Eliminar" danger onClick={() => engine.dispatch({ kind: "removeNode", nodeId: node.id })}>×</MiniButton>}
          </div>
        </div>
      </div>
      {node.children.length > 0 && (
        <SortableContext items={node.children.map((child) => child.id)} strategy={verticalListSortingStrategy}>
          {node.children.map((child) => <TreeNode key={child.id} node={child} depth={depth + 1} />)}
        </SortableContext>
      )}
    </div>
  );
}

function MiniButton({ children, label, danger, onClick }: { children: string; label: string; danger?: boolean | undefined; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      style={{ ...(danger ? styles.dangerButton : styles.button), padding: "2px 6px", minWidth: 24 }}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

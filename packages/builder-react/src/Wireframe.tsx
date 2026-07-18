import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { canInsert, findNode, findParentAndIndex } from "@astrocms/builder-core";
import type { BlockDefinitionSerialized, BuilderNode } from "@astrocms/contracts";
import { useBuilder } from "./provider.js";
import { colors, disabledStyle, styles } from "./styles.js";
import { allNodeIds, getBlock, manifestByType, newNode } from "./utils.js";

type InsertOverlay = { kind: "insert"; parentId: string; index: number; trigger: HTMLElement };
type NodeOverlay = { kind: "more" | "move"; nodeId: string; trigger: HTMLElement };
type OverlayState = InsertOverlay | NodeOverlay | null;

const toneByType: Record<string, string> = {
  "core/section": colors.wireframeSection,
  "core/columns": colors.wireframeColumns,
  "site/hero": colors.wireframeHero,
};

/** Vista estructural intencionalmente sin DnD: el orden se cambia con arriba/abajo o Mover a…. */
export function Wireframe() {
  const { state, manifest } = useBuilder();
  const [overlay, setOverlay] = useState<OverlayState>(null);
  const blocks = useMemo(() => manifestByType(manifest), [manifest]);
  const rootLabel = blocks.get(state.document.root.type)?.label ?? "Página";

  useEffect(() => setOverlay(null), [state.document.id]);
  // Estable entre re-renders del engine (p.ej. node-selected del iframe keep-alive) para
  // que el effect de foco del menú no se re-dispare y robe la posición del usuario.
  const closeOverlay = useCallback(() => {
    setOverlay((current) => {
      const trigger = current?.trigger;
      requestAnimationFrame(() => trigger?.focus());
      return null;
    });
  }, []);

  return (
    <div style={wireframeStyles.viewport} data-testid="wireframe-view">
      <div role="group" aria-label={rootLabel} style={wireframeStyles.page}>
        <div style={wireframeStyles.rootHeader}>
          <span style={{ fontWeight: 700 }}>{rootLabel}</span>
        </div>
        <ChildrenList parent={state.document.root} depth={0} blocks={blocks} openOverlay={setOverlay} />
      </div>
      {overlay?.kind === "insert" ? <InsertMenu overlay={overlay} close={closeOverlay} /> : null}
      {overlay?.kind === "more" ? (
        <MoreMenu overlay={overlay} close={closeOverlay} openOverlay={setOverlay} />
      ) : null}
      {overlay?.kind === "move" ? <MoveMenu overlay={overlay} close={closeOverlay} /> : null}
    </div>
  );
}

function ChildrenList({ parent, depth, blocks, openOverlay }: {
  parent: BuilderNode;
  depth: number;
  blocks: Map<string, BlockDefinitionSerialized>;
  openOverlay: (overlay: OverlayState) => void;
}) {
  return (
    <div style={{ ...wireframeStyles.children, ...(parent.children.length === 0 ? wireframeStyles.emptyChildren : {}) }}>
      {parent.children.map((child, index) => (
        <div key={child.id}>
          <InsertButton parent={parent} index={index} large={false} openOverlay={openOverlay} />
          <WireframeNode node={child} depth={depth + 1} blocks={blocks} openOverlay={openOverlay} />
        </div>
      ))}
      <InsertButton parent={parent} index={parent.children.length} large={parent.children.length === 0} openOverlay={openOverlay} />
    </div>
  );
}

function WireframeNode({ node, depth, blocks, openOverlay }: {
  node: BuilderNode;
  depth: number;
  blocks: Map<string, BlockDefinitionSerialized>;
  openOverlay: (overlay: OverlayState) => void;
}) {
  const { engine, state } = useBuilder();
  const block = blocks.get(node.type);
  // Contenedor por capability; si el tipo no está en el manifiesto (p.ej. custom) pero tiene
  // hijos, se trata como contenedor para no ocultar su subárbol.
  const container = block ? block.capabilities.acceptsChildren === true : node.children.length > 0;
  const selected = state.selectedNodeId === node.id;
  const tone = container ? toneByType[node.type] ?? colors.wireframeContainer : colors.wireframeModule;
  const label = block?.label ?? node.type;

  return (
    <div
      role="group"
      aria-label={label}
      data-node-id={node.id}
      data-node-type={node.type}
      data-wireframe-tone={toneName(node.type, container)}
      style={{ ...wireframeStyles.node, marginLeft: Math.min(depth - 1, 5) * 12, borderColor: selected ? colors.selectedBorder : colors.border }}
    >
      <div style={{ ...wireframeStyles.bar, background: tone, opacity: node.hidden ? 0.66 : 1 }}>
        <button type="button" style={wireframeStyles.labelButton} onClick={() => engine.select(node.id)}>
          {node.hidden ? "Oculto: " : ""}{label}
        </button>
        {container && !toneByType[node.type] ? <span style={wireframeStyles.badge}>Contenedor</span> : null}
        <NodeToolbar node={node} block={block} openOverlay={openOverlay} />
      </div>
      {container ? <ChildrenList parent={node} depth={depth} blocks={blocks} openOverlay={openOverlay} /> : null}
    </div>
  );
}

function NodeToolbar({ node, block, openOverlay }: {
  node: BuilderNode;
  block: BlockDefinitionSerialized | undefined;
  openOverlay: (overlay: OverlayState) => void;
}) {
  const { engine, manifest } = useBuilder();
  const caps = block?.capabilities;
  const canOpenMore = !node.locked || caps?.acceptsChildren;
  const duplicateLocation = findParentAndIndex(engine.getState().document.root, node.id);
  const duplicateParentBlock = duplicateLocation ? getBlock(manifest, duplicateLocation.parent.type) : undefined;
  const canDuplicate = Boolean(caps?.duplicable && !node.locked && duplicateLocation && hasCapacity(duplicateLocation.parent, duplicateParentBlock));
  const duplicate = () => {
    const before = engine.getState().document.root;
    const location = findParentAndIndex(before, node.id);
    if (!location) return;
    engine.dispatch({ kind: "duplicateNode", nodeId: node.id });
    const nextParent = findNode(engine.getState().document.root, location.parent.id);
    const copy = nextParent?.children[location.index + 1];
    if (copy) engine.select(copy.id);
  };
  const remove = () => {
    const wasSelected = engine.getState().selectedNodeId === node.id;
    engine.dispatch({ kind: "removeNode", nodeId: node.id });
    if (wasSelected) engine.select(null);
  };

  return (
    <div role="toolbar" aria-label={`Acciones de ${block?.label ?? node.type}`} style={wireframeStyles.toolbar}>
      <IconButton label="Ajustes" onClick={() => engine.select(node.id)}>⚙</IconButton>
      {canDuplicate ? <IconButton label="Duplicar" onClick={duplicate}>⧉</IconButton> : null}
      {caps?.hideable ? (
        <IconButton label={node.hidden ? "Mostrar" : "Ocultar"} onClick={() => engine.dispatch({ kind: "setHidden", nodeId: node.id, hidden: !node.hidden })}>◐</IconButton>
      ) : null}
      {caps?.removable && !node.locked ? <IconButton label="Eliminar" danger onClick={remove}>×</IconButton> : null}
      {canOpenMore ? (
        <IconButton label="Más" onClick={(_, trigger) => openOverlay({ kind: "more", nodeId: node.id, trigger })}>⋮</IconButton>
      ) : null}
    </div>
  );
}

function InsertButton({ parent, index, large, openOverlay }: {
  parent: BuilderNode;
  index: number;
  large: boolean;
  openOverlay: (overlay: OverlayState) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Insertar bloque en posición ${index + 1}`}
      style={{ ...wireframeStyles.insertButton, ...(large ? wireframeStyles.insertButtonLarge : {}) }}
      onClick={(event) => openOverlay({ kind: "insert", parentId: parent.id, index, trigger: event.currentTarget })}
    >
      +
    </button>
  );
}

function InsertMenu({ overlay, close }: { overlay: InsertOverlay; close: () => void }) {
  const { engine, manifest } = useBuilder();
  const parent = findNode(engine.getState().document.root, overlay.parentId);
  const [query, setQuery] = useState("");
  const options = parent && hasCapacity(parent, getBlock(manifest, parent.type))
    ? manifest.blocks.filter((block) => canInsert(manifest, parent.type, block.type))
    : [];
  const visible = options.filter((block) => block.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const categories = groupByCategory(visible);

  const insert = (block: BlockDefinitionSerialized) => {
    const node = newNode(block);
    engine.dispatch({ kind: "insertNode", parentId: overlay.parentId, index: overlay.index, node });
    engine.select(node.id);
    close();
  };

  return (
    <OverlayMenu trigger={overlay.trigger} label="Insertar bloque" close={close}>
      {options.length > 8 ? (
        <input aria-label="Buscar bloques" value={query} onChange={(event) => setQuery(event.target.value)} style={wireframeStyles.search} />
      ) : null}
      {visible.length === 0 ? <p style={wireframeStyles.emptyMessage}>No se puede insertar nada aquí</p> : null}
      {[...categories].map(([category, categoryBlocks]) => (
        <div key={category} role="presentation">
          <div style={wireframeStyles.category}>{category}</div>
          {categoryBlocks.map((block) => <MenuButton key={block.type} onClick={() => insert(block)}>{block.label}</MenuButton>)}
        </div>
      ))}
    </OverlayMenu>
  );
}

function MoreMenu({ overlay, close, openOverlay }: {
  overlay: NodeOverlay;
  close: () => void;
  openOverlay: (overlay: OverlayState) => void;
}) {
  const { engine, manifest, state } = useBuilder();
  const node = findNode(state.document.root, overlay.nodeId);
  if (!node) return null;
  const block = getBlock(manifest, node.type);
  const location = findParentAndIndex(state.document.root, node.id);
  const move = (toIndex: number) => {
    if (!location || node.locked) return;
    engine.dispatch({ kind: "moveNode", nodeId: node.id, toParentId: location.parent.id, toIndex });
    close();
  };

  return (
    <OverlayMenu trigger={overlay.trigger} label={`Más acciones de ${block?.label ?? node.type}`} close={close}>
      {!node.locked ? (
        <>
          <MenuButton disabled={!location || location.index === 0} onClick={() => move((location?.index ?? 0) - 1)}>Mover arriba</MenuButton>
          <MenuButton disabled={!location || location.index === location.parent.children.length - 1} onClick={() => move((location?.index ?? 0) + 1)}>Mover abajo</MenuButton>
          <MenuButton onClick={() => openOverlay({ kind: "move", nodeId: node.id, trigger: overlay.trigger })}>Mover a…</MenuButton>
        </>
      ) : null}
      {block?.capabilities.acceptsChildren ? (
        <MenuButton onClick={() => openOverlay({ kind: "insert", parentId: node.id, index: node.children.length, trigger: overlay.trigger })}>Añadir hijo</MenuButton>
      ) : null}
    </OverlayMenu>
  );
}

function MoveMenu({ overlay, close }: { overlay: NodeOverlay; close: () => void }) {
  const { engine, manifest, state } = useBuilder();
  const node = findNode(state.document.root, overlay.nodeId);
  const excluded = new Set(node ? allNodeIds(node) : []);
  const source = node ? findParentAndIndex(state.document.root, node.id)?.parent.id : undefined;
  // "Mover a…" es reparenting: excluye el nodo y sus descendientes (ciclos) y el padre
  // ACTUAL (reordenar en el mismo padre es ↑/↓; moverlo ahí sería un no-op que ensucia undo).
  const destinations = node ? collectContainers(state.document.root, manifest).filter(({ node: target }) => {
    if (excluded.has(target.id) || target.id === source) return false;
    if (!canInsert(manifest, target.type, node.type)) return false;
    return hasCapacity(target, getBlock(manifest, target.type));
  }) : [];

  return (
    <OverlayMenu trigger={overlay.trigger} label="Mover a" close={close}>
      {destinations.length === 0 ? <p style={wireframeStyles.emptyMessage}>No hay destinos válidos</p> : null}
      {destinations.map(({ node: target, path }) => (
        <MenuButton key={target.id} onClick={() => {
          engine.dispatch({ kind: "moveNode", nodeId: overlay.nodeId, toParentId: target.id, toIndex: target.children.length });
          close();
        }}>
          {path}
        </MenuButton>
      ))}
    </OverlayMenu>
  );
}

function OverlayMenu({ trigger, label, close, children }: { trigger: HTMLElement; label: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Foco inicial SOLO al montar: no re-robar el foco en re-renders del engine.
  useEffect(() => {
    const menu = ref.current;
    (menu?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? menu?.querySelector<HTMLElement>("input") ?? menu)?.focus();
  }, []);
  useEffect(() => {
    const menu = ref.current;
    const outside = (event: PointerEvent) => {
      if (!menu?.contains(event.target as Node) && !trigger.contains(event.target as Node)) close();
    };
    // Escape en CAPTURA a nivel window: cierra el menú ANTES que el listener global del
    // Toolbar (burbuja) — deselecciona — sin depender de dónde esté el foco.
    // stopImmediatePropagation corta la cadena para que el Toolbar no reciba el evento.
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", onEscape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", onEscape, true);
    };
  }, [close, trigger]);
  const rect = trigger.getBoundingClientRect();
  return (
    <div ref={ref} role="menu" aria-label={label} tabIndex={-1} style={{ ...wireframeStyles.menu, top: rect.bottom + 4, left: Math.max(4, Math.min(rect.left, window.innerWidth - 260)) }}>
      {children}
    </div>
  );
}

function IconButton({ label, danger, onClick, children }: {
  label: string;
  danger?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>, trigger: HTMLButtonElement) => void;
  children: string;
}) {
  // El icono de peligro conserva el texto blanco (AA sobre las barras de color); la señal de
  // "eliminar" la da el aria-label + el fondo rojizo, no un color de glifo de bajo contraste.
  return <button type="button" title={label} aria-label={label} style={{ ...wireframeStyles.iconButton, ...(danger ? { background: "rgba(190,18,60,.55)" } : {}) }} onClick={(event) => { event.stopPropagation(); onClick(event, event.currentTarget); }}>{children}</button>;
}

function MenuButton({ disabled = false, onClick, children }: { disabled?: boolean; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; children: ReactNode }) {
  return <button type="button" role="menuitem" disabled={disabled} style={{ ...wireframeStyles.menuButton, ...disabledStyle(disabled) }} onClick={onClick}>{children}</button>;
}

function hasCapacity(node: BuilderNode, block: BlockDefinitionSerialized | undefined): boolean {
  return block?.constraints.maxChildren === undefined || node.children.length < block.constraints.maxChildren;
}

function groupByCategory(blocks: BlockDefinitionSerialized[]): Map<string, BlockDefinitionSerialized[]> {
  const groups = new Map<string, BlockDefinitionSerialized[]>();
  for (const block of blocks) groups.set(block.category, [...(groups.get(block.category) ?? []), block]);
  return groups;
}

function collectContainers(node: BuilderNode, manifest: ReturnType<typeof useBuilder>["manifest"], labels: string[] = []): { node: BuilderNode; path: string }[] {
  const block = getBlock(manifest, node.type);
  // La raíz (core/page) NO está en el manifiesto demo, así que block es undefined; es un
  // contenedor válido (canInsert lo permite por allowedParents del hijo). Sin este caso,
  // "Mover a…" no podría reparentar de vuelta al nivel de página en producción.
  const isRoot = labels.length === 0;
  const path = [...labels, block?.label ?? (isRoot ? "Página" : node.type)];
  const isContainer = isRoot || (block ? block.capabilities.acceptsChildren === true : node.children.length > 0);
  const own = isContainer ? [{ node, path: path.join(" › ") }] : [];
  return [...own, ...node.children.flatMap((child) => collectContainers(child, manifest, path))];
}

function toneName(type: string, container: boolean): string {
  if (!container) return "module";
  if (type === "core/section") return "section";
  if (type === "core/columns") return "columns";
  if (type === "site/hero") return "hero";
  return "container";
}

const wireframeStyles = {
  viewport: { minHeight: "100%", position: "relative" },
  page: { maxWidth: 960, margin: "0 auto", padding: 12, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10 },
  rootHeader: { padding: "10px 12px", borderRadius: 7, background: colors.subtle, border: `1px solid ${colors.border}` },
  children: { padding: "7px 7px 2px", minHeight: 28 },
  emptyChildren: { display: "grid", placeItems: "center", minHeight: 72 },
  node: { border: "2px solid", borderRadius: 8, marginBottom: 3, overflow: "visible" },
  bar: { minHeight: 38, display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: 5, color: colors.wireframeText, boxShadow: `inset 0 0 0 1px ${colors.wireframeBorder}` },
  labelButton: { flex: 1, border: 0, background: "transparent", color: "inherit", textAlign: "left", padding: "6px", cursor: "pointer", fontWeight: 700 },
  badge: { padding: "2px 6px", border: "1px solid rgba(255,255,255,.55)", borderRadius: 999, fontSize: 10 },
  toolbar: { display: "flex", gap: 3 },
  iconButton: { width: 29, height: 29, padding: 0, border: "1px solid rgba(255,255,255,.5)", borderRadius: 5, background: "rgba(0,0,0,.16)", color: colors.wireframeText, cursor: "pointer" },
  insertButton: { display: "block", width: 30, height: 22, margin: "2px auto", padding: 0, border: `1px dashed ${colors.accent}`, borderRadius: 999, background: colors.surface, color: colors.accent, fontWeight: 800, cursor: "pointer", lineHeight: 1 },
  insertButtonLarge: { width: 46, height: 46, fontSize: 23 },
  menu: { position: "fixed", zIndex: 1000, width: 250, maxHeight: "min(420px, 70vh)", overflow: "auto", padding: 6, border: `1px solid ${colors.border}`, borderRadius: 8, background: colors.surface, color: colors.text, boxShadow: "0 12px 30px rgba(15,23,42,.22)" },
  menuButton: { display: "block", width: "100%", border: 0, borderRadius: 5, background: "transparent", color: colors.text, padding: "8px 9px", textAlign: "left", cursor: "pointer", fontSize: 13 },
  category: { padding: "7px 9px 3px", color: colors.muted, fontSize: 11, fontWeight: 800, textTransform: "uppercase" },
  search: { ...styles.input, marginBottom: 5 },
  emptyMessage: { margin: 0, padding: 12, color: colors.muted, fontSize: 13 },
} satisfies Record<string, CSSProperties>;

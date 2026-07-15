import type {
  BlockManifest,
  BuilderCommand,
  BuilderDocument,
  BuilderNode,
  ValidationResult,
} from "@astrocms/contracts";
import { applyCommand } from "./commands.js";
import { cloneWithNewIds, findNode, type GenId } from "./tree.js";
import { validateDocument } from "./validate.js";

export interface BuilderState {
  document: BuilderDocument;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  breakpoint: string;
}

export interface EngineOptions {
  manifest: BlockManifest;
  genId?: GenId;
  breakpoint?: string;
  maxHistory?: number;
}

export interface BuilderEngine {
  getState(): BuilderState;
  dispatch(cmd: BuilderCommand): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  select(nodeId: string | null): void;
  hover(nodeId: string | null): void;
  setBreakpoint(bp: string): void;
  clone(nodeId: string): BuilderNode | undefined;
  validate(): ValidationResult;
  subscribe(listener: (s: BuilderState) => void): () => void;
}

const defaultGenId: GenId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "n_" + Math.floor(performance.now() * 1000).toString(36);

/** Motor del builder, framework-agnóstico. Undo/redo por snapshots (determinista). */
export function createEngine(document: BuilderDocument, opts: EngineOptions): BuilderEngine {
  const genId = opts.genId ?? defaultGenId;
  const maxHistory = opts.maxHistory ?? 100;

  let state: BuilderState = {
    document,
    selectedNodeId: null,
    hoveredNodeId: null,
    breakpoint:
      opts.breakpoint ??
      opts.manifest.tokens.breakpoints[opts.manifest.tokens.breakpoints.length - 1]?.name ??
      "desktop",
  };
  const undoStack: BuilderDocument[] = [];
  const redoStack: BuilderDocument[] = [];
  const listeners = new Set<(s: BuilderState) => void>();

  function emit() {
    for (const l of listeners) l(state);
  }
  function set(next: Partial<BuilderState>) {
    state = { ...state, ...next };
    emit();
  }

  return {
    getState: () => state,

    dispatch(cmd) {
      const next = applyCommand(state.document, cmd, genId);
      if (next === state.document) return; // no-op → no ensucia el historial
      undoStack.push(state.document);
      if (undoStack.length > maxHistory) undoStack.shift();
      redoStack.length = 0;
      set({ document: next });
    },

    undo() {
      const prev = undoStack.pop();
      if (!prev) return;
      redoStack.push(state.document);
      set({ document: prev });
    },

    redo() {
      const next = redoStack.pop();
      if (!next) return;
      undoStack.push(state.document);
      set({ document: next });
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,

    select: (nodeId) => set({ selectedNodeId: nodeId }),
    hover: (nodeId) => set({ hoveredNodeId: nodeId }),
    setBreakpoint: (bp) => set({ breakpoint: bp }),

    clone(nodeId) {
      const node = findNode(state.document.root, nodeId);
      return node ? cloneWithNewIds(node, genId) : undefined;
    },

    validate: () => validateDocument(state.document, opts.manifest),

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

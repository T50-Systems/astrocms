import type { EntryStatus } from "@astrocms/contracts";
import { conflict } from "./errors.js";

/**
 * Modelo de comportamiento del ciclo de vida de un entry (tabla de transiciones).
 * Ciclo simple → status enum + transition table (no workflow engine). Escalar a FSM/
 * workflow sólo si aparecen timers, tareas humanas, reintentos o procesos multi-día.
 */
export const ENTRY_TRANSITIONS: Record<EntryStatus, EntryStatus[]> = {
  draft: ["published", "archived"],
  published: ["draft", "archived"], // unpublish => draft
  archived: ["draft"],
};

export function canTransition(from: EntryStatus, to: EntryStatus): boolean {
  if (from === to) return true;
  return ENTRY_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: EntryStatus, to: EntryStatus): void {
  if (!canTransition(from, to)) {
    throw conflict(`Transición no permitida: ${from} → ${to}`, { from, to });
  }
}

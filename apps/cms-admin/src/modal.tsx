import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "3rem 1rem",
  zIndex: 100,
};
const dialog: CSSProperties = {
  background: "#fff",
  color: "#1a1a1a",
  borderRadius: 8,
  width: "100%",
  maxWidth: 520,
  boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
};
const head: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.9rem 1.1rem",
  borderBottom: "1px solid #eee",
};
const body: CSSProperties = { padding: "1.1rem", overflow: "auto" };
const foot: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.5rem",
  padding: "0.8rem 1.1rem",
  borderTop: "1px solid #eee",
};

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}

/** Modal accesible: overlay, Escape para cerrar, role=dialog. */
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div role="presentation" style={overlay} onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} style={dialog} onMouseDown={(e) => e.stopPropagation()}>
        <div style={head}>
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{title}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            style={{ border: 0, background: "transparent", fontSize: "1.3rem", cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={body}>{children}</div>
        <div style={foot}>{footer}</div>
      </div>
    </div>,
    document.body,
  );
}

import type { CSSProperties } from "react";

export const colors = {
  text: "#172033",
  muted: "#667085",
  border: "#d9dee8",
  surface: "#ffffff",
  subtle: "#f6f7f9",
  selected: "#e7f0ff",
  accent: "#1d4ed8",
  danger: "#b42318",
};

export const styles = {
  shell: {
    height: "calc(100vh - 52px)",
    minHeight: 640,
    display: "grid",
    gridTemplateRows: "48px 1fr",
    color: colors.text,
    background: "#eef1f5",
    fontFamily: "system-ui, sans-serif",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "8px 12px",
    borderBottom: `1px solid ${colors.border}`,
    background: colors.surface,
  },
  body: {
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "260px minmax(360px, 1fr) 320px",
  },
  side: {
    minHeight: 0,
    overflow: "auto",
    background: colors.surface,
    borderRight: `1px solid ${colors.border}`,
  },
  right: {
    minHeight: 0,
    overflow: "auto",
    background: colors.surface,
    borderLeft: `1px solid ${colors.border}`,
  },
  panel: { padding: 12 },
  title: { margin: "0 0 8px", fontSize: 13, fontWeight: 700 },
  sectionTitle: { margin: "16px 0 8px", fontSize: 12, color: colors.muted, fontWeight: 700 },
  button: {
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    background: colors.surface,
    color: colors.text,
    padding: "7px 10px",
    fontSize: 13,
    cursor: "pointer",
  },
  primaryButton: {
    border: "1px solid #123ea6",
    borderRadius: 6,
    background: colors.accent,
    color: "#fff",
    padding: "7px 10px",
    fontSize: 13,
    cursor: "pointer",
  },
  dangerButton: {
    border: "1px solid #f2b8b5",
    borderRadius: 6,
    background: "#fff",
    color: colors.danger,
    padding: "4px 7px",
    fontSize: 12,
    cursor: "pointer",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: "7px 8px",
    fontSize: 13,
  },
  canvasWrap: { minWidth: 0, minHeight: 0, padding: 14, overflow: "auto" },
  iframe: {
    width: "100%",
    height: "100%",
    minHeight: 560,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    background: "#fff",
  },
} satisfies Record<string, CSSProperties>;

export function disabledStyle(disabled: boolean): CSSProperties {
  return disabled ? { opacity: 0.45, cursor: "not-allowed" } : {};
}

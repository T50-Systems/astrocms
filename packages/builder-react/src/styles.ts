import type { CSSProperties } from "react";

// Paleta del builder: lee los tokens del host (apps/cms-admin/src/globals.css) con
// fallback al valor original, para que el paquete funcione standalone sin Tailwind.
export const colors = {
  text: "var(--foreground, #172033)",
  muted: "var(--muted-foreground, #667085)",
  border: "var(--border, #d9dee8)",
  surface: "var(--card, #ffffff)",
  subtle: "var(--muted, #f6f7f9)",
  selected: "color-mix(in oklch, var(--primary, #1d4ed8) 12%, transparent)",
  selectedBorder: "var(--primary, #93b7ff)",
  accent: "var(--primary, #1d4ed8)",
  accentForeground: "var(--primary-foreground, #ffffff)",
  danger: "var(--destructive, #b42318)",
  dangerBorder: "var(--destructive-soft, #f2b8b5)",
  success: "var(--success-ink, #15803d)",
};

const colorTransition =
  "color 150ms var(--ease-standard, ease), background-color 150ms var(--ease-standard, ease), border-color 150ms var(--ease-standard, ease)";

export const styles = {
  shell: {
    height: "calc(100vh - 52px)",
    minHeight: 640,
    display: "grid",
    gridTemplateRows: "48px 1fr",
    color: colors.text,
    background: "var(--canvas, #eef1f5)",
    fontFamily: "inherit",
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
    transition: colorTransition,
  },
  primaryButton: {
    border: `1px solid ${colors.accent}`,
    borderRadius: 6,
    background: colors.accent,
    color: colors.accentForeground,
    padding: "7px 10px",
    fontSize: 13,
    cursor: "pointer",
    transition: colorTransition,
  },
  dangerButton: {
    border: `1px solid ${colors.dangerBorder}`,
    borderRadius: 6,
    background: colors.surface,
    color: colors.danger,
    padding: "4px 7px",
    fontSize: 12,
    cursor: "pointer",
    transition: colorTransition,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: "7px 8px",
    fontSize: 13,
    transition: colorTransition,
  },
  canvasWrap: { minWidth: 0, minHeight: 0, padding: 14, overflow: "auto" },
  iframe: {
    width: "100%",
    height: "100%",
    minHeight: 560,
    border: `1px solid ${colors.border}`,
    borderRadius: "var(--radius, 10px)",
    background: colors.surface,
  },
} satisfies Record<string, CSSProperties>;

export function disabledStyle(disabled: boolean): CSSProperties {
  return disabled ? { opacity: 0.45, cursor: "not-allowed" } : {};
}

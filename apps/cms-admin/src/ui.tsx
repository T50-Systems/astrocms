import type { CSSProperties, ReactNode } from "react";

const styles: Record<string, CSSProperties> = {
  page: { fontFamily: "system-ui, sans-serif", maxWidth: "48rem", margin: "2rem auto", padding: "0 1rem", color: "#1a1a1a" },
  button: { padding: "0.5rem 0.9rem", borderRadius: 6, border: "1px solid #d0d0d0", background: "#111", color: "#fff", cursor: "pointer", fontSize: "0.95rem" },
  buttonGhost: { padding: "0.4rem 0.8rem", borderRadius: 6, border: "1px solid #d0d0d0", background: "#fff", color: "#111", cursor: "pointer", fontSize: "0.9rem" },
  input: { width: "100%", padding: "0.55rem 0.7rem", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.95rem", boxSizing: "border-box" },
  label: { display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" },
  field: { marginBottom: "1rem" },
  card: { border: "1px solid #eee", borderRadius: 8, padding: "0.8rem 1rem", marginBottom: "0.6rem", display: "flex", justifyContent: "space-between", alignItems: "center" },
  error: { background: "#fdecea", color: "#611a15", padding: "0.7rem 1rem", borderRadius: 6, margin: "1rem 0" },
  muted: { color: "#666" },
};

export function Page({ children }: { children: ReactNode }) {
  return <div style={styles.page}>{children}</div>;
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { ghost?: boolean }) {
  const { ghost, style, ...rest } = props;
  return <button {...rest} style={{ ...(ghost ? styles.buttonGhost : styles.button), ...style }} />;
}

export function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string | undefined; children: ReactNode }) {
  return (
    <div style={styles.field}>
      <label style={styles.label} htmlFor={htmlFor}>{label}</label>
      {children}
      {error && <div role="alert" style={{ color: "#b00020", fontSize: "0.8rem", marginTop: "0.25rem" }}>{error}</div>}
    </div>
  );
}

export const inputStyle = styles.input;
export const cardStyle = styles.card;

export function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "Error inesperado";
  return <div role="alert" style={styles.error}>{msg}</div>;
}

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return <p role="status" style={styles.muted}>{label}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p style={styles.muted}>{children}</p>;
}

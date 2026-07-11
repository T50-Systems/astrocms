import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";

/** Layout tipo WordPress: barra superior + barra lateral + área de contenido. */

const NAV: Array<{ to: string; label: string; icon: string }> = [
  { to: "/", label: "Páginas", icon: "📄" },
  { to: "/media", label: "Medios", icon: "🖼️" },
  { to: "/taxonomies", label: "Categorías", icon: "🏷️" },
  { to: "/tags", label: "Etiquetas", icon: "🔖" },
  { to: "/menus", label: "Menús", icon: "☰" },
  { to: "/settings", label: "Ajustes", icon: "⚙️" },
];

const topbar: CSSProperties = {
  height: 40,
  background: "#1d2327",
  color: "#f0f0f1",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 0.75rem",
  position: "sticky",
  top: 0,
  zIndex: 10,
  fontSize: 13,
};
const SIDEBAR_W = 180;
const TOPBAR_H = 40;
const sidebar: CSSProperties = {
  width: SIDEBAR_W,
  background: "#23282d",
  color: "#c3c4c7",
  // Totalmente fija: no se desplaza con el scroll (sólo el contenido se mueve).
  position: "fixed",
  top: TOPBAR_H,
  left: 0,
  bottom: 0,
  overflowY: "auto",
  paddingTop: 8,
  fontSize: 14,
};
const link: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  padding: "0.6rem 0.9rem",
  color: "#c3c4c7",
  textDecoration: "none",
};
const linkActive: CSSProperties = { background: "#2271b1", color: "#fff" };
// La barra lateral es fixed (fuera del flujo): el contenido se desplaza a la derecha con un margen.
const content: CSSProperties = { minWidth: 0, background: "#f0f0f1", marginLeft: SIDEBAR_W, minHeight: "calc(100vh - 40px)" };

export interface AppShellProps {
  email: string;
  siteName: string;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({ email, siteName, onLogout, children }: AppShellProps) {
  return (
    <div style={{ minHeight: "100vh", background: "#f0f0f1" }}>
      <header style={topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link to="/" style={{ color: "#f0f0f1", textDecoration: "none", fontWeight: 700 }}>
            ⚡ {siteName}
          </Link>
          <Link to="/pages/new" style={{ color: "#72aee6", textDecoration: "none" }}>
            + Nuevo
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span>Hola, {email}</span>
          <button
            type="button"
            onClick={onLogout}
            style={{ background: "transparent", color: "#f0f0f1", border: "1px solid #3c434a", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
          >
            Salir
          </button>
        </div>
      </header>

      <div>
        <nav aria-label="Navegación principal" style={sidebar}>
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={link}
              activeProps={{ style: { ...link, ...linkActive } }}
              activeOptions={{ exact: item.to === "/" }}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <main style={content}>{children}</main>
      </div>
    </div>
  );
}

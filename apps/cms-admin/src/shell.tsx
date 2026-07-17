import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Bot, FileText, Image, LayoutList, LogOut, Palette, Plus, Settings, Tag, Tags, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { ThemeToggle } from "@/components/theme-toggle.tsx";
import { cn } from "@/lib/utils.ts";

/** Layout tipo panel: barra superior + barra lateral fija + área de contenido. */

const NAV: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/", label: "Páginas", icon: FileText },
  { to: "/media", label: "Medios", icon: Image },
  { to: "/taxonomies", label: "Categorías", icon: Tag },
  { to: "/tags", label: "Etiquetas", icon: Tags },
  { to: "/menus", label: "Menús", icon: LayoutList },
  { to: "/settings", label: "Ajustes", icon: Settings },
  { to: "/guidelines", label: "Guías de IA", icon: Bot },
  { to: "/tokens", label: "Tokens", icon: Palette },
];

export interface AppShellProps {
  email: string;
  siteName: string;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({ email, siteName, onLogout, children }: AppShellProps) {
  // El pathname sirve de `key` al contenedor de la ruta: al navegar se remonta y
  // vuelve a correr la animación de entrada. AppShell vive bajo RouterProvider.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen min-w-[20rem] bg-canvas">
      <header className="fixed inset-x-0 top-0 z-20 flex h-12 items-center justify-between border-b border-white/10 bg-sidebar px-3 text-sidebar-foreground">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-1.5 font-bold">
            {/* Sobre bg-sidebar va sidebar-foreground: sidebar-primary-foreground es
                "texto sobre superficies bg-sidebar-primary" y ahora lo adapta el bridge
                al brand — un brand claro lo volvería oscuro e invisible aquí. */}
            <Zap className="size-4 text-sidebar-foreground" />
            {siteName}
          </Link>
          <Link to="/pages/new" className="flex items-center gap-1 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <Plus className="size-3.5" /> Nuevo
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="truncate max-w-[14rem] text-sidebar-foreground/70">Hola, {email}</span>
          <ThemeToggle className="size-7 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" />
          <Button variant="ghost" size="sm" onClick={onLogout} className="h-7 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <LogOut className="size-3.5" /> Salir
          </Button>
        </div>
      </header>

      <nav aria-label="Navegación principal" className="fixed bottom-0 left-0 top-12 w-56 overflow-y-auto bg-sidebar py-3 text-sidebar-foreground">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn("relative flex items-center gap-2.5 px-4 py-2 text-sm text-sidebar-foreground/80 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground")}
            activeProps={{ className: "relative flex items-center gap-2.5 px-4 py-2 text-sm font-medium bg-sidebar-accent text-sidebar-foreground before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-full before:bg-sidebar-primary" }}
            activeOptions={{ exact: item.to === "/" }}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="ml-56 min-h-[calc(100vh-3rem)] pt-12">
        <div key={pathname} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-standard fill-mode-both">
          {children}
        </div>
      </main>
    </div>
  );
}

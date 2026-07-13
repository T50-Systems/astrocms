import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

const STORAGE_KEY = "astrocms-theme";

/** Alterna el modo claro/oscuro añadiendo/quitando la clase `dark` en <html>. */
export function ThemeToggle({ className }: { className?: string }) {
  const toggle = React.useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      /* localStorage no disponible: se ignora la persistencia. */
    }
  }, []);

  // Los dos iconos conviven apilados; la variante `dark` los rota/escala. Al alternar
  // la clase `.dark` del <html>, transition-transform anima el giro de forma sutil.
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Cambiar tema"
      className={className}
    >
      <span className="relative inline-flex size-4 items-center justify-center">
        <Sun className="absolute size-4 rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute size-4 rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100" />
      </span>
    </Button>
  );
}

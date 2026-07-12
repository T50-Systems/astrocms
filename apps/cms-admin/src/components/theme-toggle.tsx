import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

const STORAGE_KEY = "astrocms-theme";

/** Alterna el modo claro/oscuro añadiendo/quitando la clase `dark` en <html>. */
export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = React.useState<boolean>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  const toggle = React.useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      /* localStorage no disponible: se ignora la persistencia. */
    }
    setIsDark(next);
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Cambiar tema"
      className={className}
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils.ts";

/** Contenedor estándar de las pantallas del panel (ancho máximo + padding). */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-6xl p-6", className)}>{children}</div>;
}

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils.ts";

/** Estado vacío reutilizable: icono opcional, título y acción opcional. */
export function EmptyState({
  icon: Icon,
  title,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // min-h-56 iguala la altura del skeleton de carga: al resolver la query
        // la caja no "salta" de tamaño (skeleton y estado vacío ocupan lo mismo).
        "flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card px-6 py-10 text-center",
        className,
      )}
    >
      {Icon && <Icon className="size-6 text-muted-foreground" aria-hidden />}
      <p className="text-sm text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils.ts";

type AlertVariant = "destructive" | "success" | "warning" | "info";

const base = "rounded-md px-3 py-2 text-sm";
const variants: Record<AlertVariant, string> = {
  destructive: "bg-destructive-soft text-destructive-ink",
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  info: "bg-primary-soft text-primary",
};

/** Mensaje contextual (error, éxito, aviso, info). `destructive` usa role=alert; el resto role=status. */
export function Alert({
  variant = "destructive",
  children,
  className,
}: {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p role={variant === "destructive" ? "alert" : "status"} className={cn(base, variants[variant], className)}>
      {children}
    </p>
  );
}

/** Normaliza un error desconocido a un mensaje legible. */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Error inesperado";
}

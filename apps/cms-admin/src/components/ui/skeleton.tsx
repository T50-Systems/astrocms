import { cn } from "@/lib/utils.ts";

/** Marcador de carga con pulso animado (respeta prefers-reduced-motion). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)} aria-hidden />;
}

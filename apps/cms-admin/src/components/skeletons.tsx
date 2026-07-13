import { Skeleton } from "@/components/ui/skeleton.tsx";

/**
 * Skeletons con la MISMA silueta que el contenido real de cada pantalla.
 * Objetivo: que el swap carga→datos no cambie la forma (sin "salto de hidratación").
 * Todos heredan el `motion-reduce` del Skeleton base.
 */

/** Cabecera de página: título a la izquierda + grupo de botones a la derecha. */
export function PageHeaderSkeleton({ actions = 1 }: { actions?: number }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <Skeleton className="h-7 w-44" />
      <div className="flex items-center gap-2">
        {Array.from({ length: actions }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>
    </div>
  );
}

/** Tabla dentro de una card: cabecera + N filas (checkbox + celda de 2 líneas + columnas). */
export function TableSkeleton({ rows = 6, cols = 3 }: { rows?: number; cols?: number }) {
  const trailing = Math.max(0, cols - 1);
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
      <div className="flex items-center gap-4 border-b px-4 py-3">
        <Skeleton className="size-4 rounded-sm" />
        <Skeleton className="h-3 w-24" />
        <div className="ml-auto flex gap-8">
          {Array.from({ length: trailing }, (_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-start gap-4 border-b px-4 py-4 last:border-b-0">
          <Skeleton className="mt-0.5 size-4 rounded-sm" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 max-w-56" />
            <Skeleton className="h-3 max-w-32" />
          </div>
          {Array.from({ length: trailing }, (_, c) => (
            <Skeleton key={c} className="h-4 w-20" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Formulario: secciones con título + descripción + campos (label + control). */
export function FormSkeleton({ sections = 2, fields = 3 }: { sections?: number; fields?: number }) {
  return (
    <div className="max-w-2xl space-y-8">
      {Array.from({ length: sections }, (_, s) => (
        <div key={s} className="space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          {Array.from({ length: fields }, (_, f) => (
            <div key={f} className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Editor de página: barra de acciones + rejilla contenido (título + cuerpo) / barra lateral. */
export function PageEditSkeleton() {
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-96 w-full rounded-md" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </>
  );
}

/** Lista tipo árbol (menús): filas con manija + etiqueta + controles. */
export function TreeSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-4 w-40" />
          <div className="ml-auto flex gap-1.5">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="size-7 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

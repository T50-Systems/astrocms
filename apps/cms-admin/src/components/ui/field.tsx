import type { ReactNode } from "react";
import { Label } from "@/components/ui/label.tsx";

/**
 * Campo de formulario: etiqueta + control + ayuda/error opcionales.
 *
 * El consumidor sigue siendo responsable de poner `aria-invalid` y
 * `aria-describedby={`${id}-error`}` en el control cuando haya error.
 */
export function Field({
  id,
  label,
  error,
  help,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  help?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive-ink">
          {error}
        </p>
      )}
    </div>
  );
}

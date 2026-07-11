import { cn } from "@/lib/utils.ts";

export interface JsonTextareaProps {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
  error?: string;
  placeholder?: string;
  rows?: number;
}

export function JsonTextarea({ id, label, value, onChange, error, placeholder, rows }: JsonTextareaProps) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <textarea
        id={id}
        spellCheck={false}
        rows={rows ?? 22}
        aria-invalid={Boolean(error)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full resize-y rounded-lg border bg-zinc-900 p-4 font-mono text-sm leading-relaxed text-zinc-200 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          error ? "border-destructive" : "border-border",
        )}
      />
      {error && <p role="alert" className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}

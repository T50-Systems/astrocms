import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

export interface ModeToggleProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function ModeToggle<T extends string>({ value, options, onChange, ariaLabel }: ModeToggleProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex">
      {options.map((opt, index) => {
        const active = opt.value === value;
        return (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              active ? "bg-accent text-foreground" : "text-muted-foreground",
              index === 0 && "rounded-r-none",
              index === options.length - 1 && "rounded-l-none -ml-px",
              index > 0 && index < options.length - 1 && "rounded-none -ml-px",
            )}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}

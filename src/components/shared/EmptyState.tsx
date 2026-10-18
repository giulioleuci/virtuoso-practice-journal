import { Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  title?: string;
  hint?: string;
  icon?: LucideIcon;
  cta?: { label: string; onClick: () => void; icon?: LucideIcon };
  secondary?: { label: string; onClick: () => void };
  className?: string;
  quote?: { text: string; author: string };
}

/** Friendly empty state with optional onboarding CTA. */
export function EmptyState({ title, hint, icon: Icon, cta, secondary, className, quote }: Props) {
  return (
    <div className={cn("w-full border-y border-border px-4 py-10 text-center", className)}>
      {quote && (
        <div className="mb-4">
          <p className="font-serif text-xl italic leading-snug text-foreground/85">"{quote.text}"</p>
          <p className="mt-2 text-xs text-muted-foreground">{quote.author}</p>
        </div>
      )}
      {Icon && <Icon className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60" />}
      {title && <p className="font-serif text-xl font-semibold leading-snug">{title}</p>}
      {hint && <p className="mx-auto mt-2 max-w-[60ch] text-sm text-muted-foreground">{hint}</p>}
      {(cta || secondary) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {cta && (
            <Button onClick={cta.onClick}>
              {cta.icon ? <cta.icon /> : <Plus />} {cta.label}
            </Button>
          )}
          {secondary && <Button variant="ghost" onClick={secondary.onClick}>{secondary.label}</Button>}
        </div>
      )}
    </div>
  );
}

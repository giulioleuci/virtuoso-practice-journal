import { Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  cta?: { label: string; onClick: () => void };
  className?: string;
}

/** Friendly empty state with optional onboarding CTA. */
export function EmptyState({ title, hint, icon: Icon, cta, className }: Props) {
  const Element = cta ? "button" : "div";
  return (
    <Element
      onClick={cta?.onClick}
      className={cn(
        "paper-card p-8 text-center w-full block",
        cta && "hover:-translate-y-0.5 transition-transform group cursor-pointer",
        className
      )}
    >
      {Icon && <Icon className="h-7 w-7 mx-auto mb-3 text-muted-foreground/60" />}
      <p className="font-serif text-xl text-foreground/85 leading-snug">{title}</p>
      {hint && <p className="text-sm text-muted-foreground italic mt-2">{hint}</p>}
      {cta && (
        <span className="inline-flex items-center gap-1 text-primary font-medium text-sm mt-4 group-hover:gap-2 transition-all">
          <Plus className="h-4 w-4" /> {cta.label}
        </span>
      )}
    </Element>
  );
}

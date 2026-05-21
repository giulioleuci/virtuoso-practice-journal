import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, action, className }: Props) {
  return (
    <div className={cn("flex items-center justify-between mb-3", className)}>
      <h3 className="font-serif text-2xl">{title}</h3>
      {action && <div className="flex items-center gap-1">{action}</div>}
    </div>
  );
}

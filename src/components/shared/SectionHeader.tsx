import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, action, className }: Props) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
      <h2 className="min-w-0 break-words font-serif text-2xl">{title}</h2>
      {action && <div className="flex max-w-full flex-wrap items-center gap-1">{action}</div>}
    </div>
  );
}

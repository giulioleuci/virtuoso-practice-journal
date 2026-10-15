import type { ReactNode } from "react";

/** Page title block of the redesigned pages: serif title, optional subtitle, actions on the right. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-[min(100%,14rem)] flex-1">
        <h1 className="font-serif text-[2.25rem] font-semibold leading-[1.15] tracking-tight max-[699px]:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="mt-1.5 flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
    </header>
  );
}

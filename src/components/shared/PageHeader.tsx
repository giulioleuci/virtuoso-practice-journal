import { useEffect, type ReactNode } from "react";

/** Shared page title and actions. */
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  useEffect(() => { document.title = `${title} · Virtuoso`; }, [title]);
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-[min(100%,9rem)] flex-1">
        <h1 className="break-words font-serif text-[2.25rem] font-semibold leading-[1.15] tracking-tight max-[699px]:text-[2rem]">{title}</h1>
      </div>
      {actions && <div className="mt-1.5 flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

import { useI18n } from "@/lib/i18n";

/** Reusable skeleton loaders: the page structure stays put while data arrives. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <ul className="space-y-2" aria-busy="true" aria-label={t("common.loading")}>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="paper-skeleton h-20" />
      ))}
    </ul>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="paper-skeleton h-24" />
      <ListSkeleton />
    </div>
  );
}

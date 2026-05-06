/** Reusable skeleton loaders for list-style pages. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="space-y-2" aria-busy="true" aria-label="Loading">
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

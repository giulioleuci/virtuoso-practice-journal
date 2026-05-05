import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CheckCircle2, HelpCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function TeacherRecapSheet({ open, onOpenChange }: Props) {
  const helpRequests = useLiveQuery(() => db.helpRequests.toArray());
  const items = useLiveQuery(() => db.library.toArray());
  const subjects = useLiveQuery(() => db.subjects.toArray());

  const unresolved = useMemo(
    () => (helpRequests ?? []).filter((h) => !h.resolved).sort((a, b) => b.createdAt - a.createdAt),
    [helpRequests]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, { subjectName: string; items: Map<number | "none", { itemTitle: string; reqs: typeof unresolved }> }>();
    for (const h of unresolved) {
      const item = items?.find((i) => i.id === h.itemId);
      const subject = subjects?.find((s) => s.id === item?.subjectId);
      const subjectKey = subject?.name ?? "Other";
      if (!map.has(subjectKey)) map.set(subjectKey, { subjectName: subjectKey, items: new Map() });
      const bucket = map.get(subjectKey)!;
      const itemKey = h.itemId ?? "none";
      if (!bucket.items.has(itemKey)) {
        bucket.items.set(itemKey, { itemTitle: item?.title ?? "General", reqs: [] });
      }
      bucket.items.get(itemKey)!.reqs.push(h);
    }
    return Array.from(map.values());
  }, [unresolved, items, subjects]);

  const resolve = async (id: number) => {
    await db.helpRequests.update(id, { resolved: true });
    toast.success("Marked resolved");
  };

  const resolveAll = async () => {
    await db.transaction("rw", db.helpRequests, async () => {
      for (const h of unresolved) if (h.id) await db.helpRequests.update(h.id, { resolved: true });
    });
    toast.success("All marked resolved");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Teacher recap</SheetTitle>
          <SheetDescription>Open questions to bring to your next lesson.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {unresolved.length === 0 ? (
            <p className="paper-card p-6 text-center text-muted-foreground italic">No open questions.</p>
          ) : (
            <>
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={resolveAll}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Resolve all
                </Button>
              </div>
              {grouped.map((g) => (
                <section key={g.subjectName} className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">{g.subjectName}</h3>
                  {Array.from(g.items.values()).map((b) => (
                    <div key={b.itemTitle} className="paper-card p-3 space-y-2">
                      <div className="font-serif text-lg">{b.itemTitle}</div>
                      <ul className="space-y-1.5">
                        {b.reqs.map((r) => (
                          <li key={r.id} className="flex items-start gap-2 text-sm">
                            <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span className="flex-1">{r.question}</span>
                            <button
                              onClick={() => r.id && resolve(r.id)}
                              className="text-xs text-muted-foreground hover:text-primary"
                            >
                              Resolve
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

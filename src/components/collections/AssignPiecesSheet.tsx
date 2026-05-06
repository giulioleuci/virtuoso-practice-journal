import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Collection, type LibraryItem } from "@/lib/db";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { collectionsService } from "@/lib/services";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  collection: Collection | null;
}

export function AssignPiecesSheet({ open, onOpenChange, collection }: Props) {
  const repertoire = useLiveQuery(
    () => db.library.where("kind").equals("repertoire").filter((i) => !i.deletedAt).toArray(),
    []
  ) as LibraryItem[] | undefined;
  const links = useLiveQuery(
    () => collection?.id ? db.collectionItems.where("collectionId").equals(collection.id).toArray() : Promise.resolve([]),
    [collection?.id]
  );

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelected(new Set((links ?? []).map((l) => l.itemId)));
  }, [open, links]);

  const filtered = useMemo(() => {
    const arr = repertoire ?? [];
    if (!search.trim()) return [...arr].sort((a, b) => a.title.localeCompare(b.title));
    const q = search.trim().toLowerCase();
    return arr
      .filter((i) => i.title.toLowerCase().includes(q) || (i.composer ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [repertoire, search]);

  const toggle = (id: number) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const save = async () => {
    if (!collection?.id) return;
    const initial = new Set((links ?? []).map((l) => l.itemId));
    const toAdd = [...selected].filter((id) => !initial.has(id));
    const toRemove = [...initial].filter((id) => !selected.has(id));
    if (toAdd.length) await collectionsService.addItems(collection.id, toAdd);
    if (toRemove.length) await collectionsService.removeItems(collection.id, toRemove);
    toast.success("Pieces updated");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88vh] rounded-t-3xl bg-background p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-2 text-left">
          <SheetTitle className="font-serif text-2xl">Manage pieces</SheetTitle>
          <SheetDescription className="italic">{collection?.name}</SheetDescription>
        </SheetHeader>

        <div className="px-6 pt-2 pb-3">
          <Input
            placeholder="Search title or composer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-card"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {!filtered.length ? (
            <p className="paper-card p-6 text-center text-muted-foreground italic">
              {(repertoire?.length ?? 0) === 0 ? "No repertoire pieces yet." : "No pieces match."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((it) => {
                const active = it.id !== undefined && selected.has(it.id);
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => it.id && toggle(it.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left min-h-[56px] transition-colors",
                        active
                          ? "border-primary bg-primary/5"
                          : "border-input bg-card hover:bg-accent/40"
                      )}
                    >
                      <span className={cn(
                        "h-5 w-5 rounded border flex items-center justify-center shrink-0",
                        active ? "bg-primary border-primary text-primary-foreground" : "border-input"
                      )}>
                        {active && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block break-words font-medium">{it.title}</span>
                        {it.composer && <span className="block text-xs text-muted-foreground italic">{it.composer}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border bg-background/80 backdrop-blur">
          <div className="flex gap-3 w-full items-center">
            <span className="text-xs text-muted-foreground tabular-nums mr-auto">
              {selected.size} selected
            </span>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Collection, type ColorKey } from "@/lib/db";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { collectionsService } from "@/lib/services";
import { collectionInputSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COLORS: ColorKey[] = ["terracotta", "sage", "gold", "blue", "plum"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  collection?: Collection | null;
  onSaved?: (id: number) => void;
}

export function NewCollectionSheet({ open, onOpenChange, collection, onSaved }: Props) {
  const isEdit = !!collection?.id;
  const subjects = useLiveQuery(() => db.subjects.filter((s) => !s.deletedAt).toArray(), []);

  const [name, setName] = useState("");
  const [composer, setComposer] = useState("");
  const [catalog, setCatalog] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState<ColorKey | undefined>();
  const [defaultSubjectId, setDefaultSubjectId] = useState<number | undefined>();

  useEffect(() => {
    if (!open) return;
    setName(collection?.name ?? "");
    setComposer(collection?.composer ?? "");
    setCatalog(collection?.catalog ?? "");
    setNotes(collection?.notes ?? "");
    setColor(collection?.color);
    setDefaultSubjectId(collection?.defaultSubjectId);
  }, [open, collection?.id]);

  const input = {
    name: name.trim(),
    composer: composer.trim() || undefined,
    catalog: catalog.trim() || undefined,
    notes: notes.trim() || undefined,
    color,
    defaultSubjectId,
  };
  const parsed = collectionInputSchema.safeParse(input);
  const canSave = parsed.success;

  const save = async () => {
    if (!canSave) return;
    try {
      if (isEdit && collection?.id) {
        await collectionsService.update(collection.id, input);
        toast.success("Collection updated");
        onSaved?.(collection.id);
      } else {
        const id = await collectionsService.create(input);
        toast.success("Collection created");
        onSaved?.(id);
      }
      onOpenChange(false);
    } catch (e) {
      toast.error("Could not save");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88vh] rounded-t-3xl bg-background p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-2 text-left">
          <SheetTitle className="font-serif text-3xl">
            {isEdit ? "Edit collection" : "New collection"}
          </SheetTitle>
          <SheetDescription className="italic">
            Group repertoire pieces (e.g. an opus or book).
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nocturnes, Op. 9"
              className="bg-card text-lg h-12"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Composer</Label>
              <Input value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Chopin" className="bg-card" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Catalog</Label>
              <Input value={catalog} onChange={(e) => setCatalog(e.target.value)} placeholder="Op. 9" className="bg-card" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Color</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setColor(undefined)}
                className={cn("h-9 px-3 rounded-full text-xs border", !color ? "border-foreground" : "border-input text-muted-foreground")}
              >None</button>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition-all",
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: `hsl(var(--key-${c}))` }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Default subject</Label>
            <Select
              value={defaultSubjectId !== undefined ? String(defaultSubjectId) : "none"}
              onValueChange={(v) => setDefaultSubjectId(v === "none" ? undefined : Number(v))}
            >
              <SelectTrigger className="bg-card"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering…" className="bg-card" rows={3} />
          </div>
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border bg-background/80 backdrop-blur">
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button onClick={save} disabled={!canSave} className="flex-1">
              {isEdit ? "Save changes" : "Create collection"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

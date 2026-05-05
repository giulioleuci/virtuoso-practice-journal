import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type NoteVal } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: string; // YYYY-MM-DD
}

export function NewTaskSheet({ open, onOpenChange, date }: Props) {
  const subjects = useLiveQuery(() => db.subjects.toArray(), []);
  const library = useLiveQuery(() => db.library.toArray(), []);

  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [itemId, setItemId] = useState<number | undefined>();
  const [segmentId, setSegmentId] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState<number | undefined>();
  const [noteVal, setNoteVal] = useState<NoteVal | undefined>();

  const itemsForSubject = useMemo(
    () => (library ?? []).filter((l) => l.subjectId === subjectId),
    [library, subjectId]
  );
  const segments = useLiveQuery(
    () => (itemId ? db.segments.where("itemId").equals(itemId).toArray() : Promise.resolve([])),
    [itemId]
  );
  const selectedItem = library?.find((l) => l.id === itemId);
  const selectedSegment = segments?.find((s) => s.id === segmentId);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSubjectId(undefined);
      setItemId(undefined);
      setSegmentId(undefined);
      setTitle("");
      setBpm(undefined);
      setNoteVal(undefined);
    }
  }, [open]);

  // Prefill title + bpm from item/segment
  useEffect(() => {
    if (!selectedItem) return;
    const segLabel = selectedSegment ? ` — ${selectedSegment.label}` : "";
    setTitle(`${selectedItem.title}${segLabel}`);
    const tBpm = selectedSegment?.targetBpm ?? selectedItem.targetBpm;
    const tNote = selectedSegment?.noteVal ?? selectedItem.noteVal;
    setBpm(tBpm);
    setNoteVal(tNote);
  }, [itemId, segmentId, selectedItem, selectedSegment]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!subjectId) e.push("Pick a subject");
    if (!itemId) e.push("Pick a library item");
    if (!title.trim()) e.push("Title is required");
    if (bpm !== undefined && (bpm < 20 || bpm > 400)) e.push("BPM out of range");
    return e;
  }, [subjectId, itemId, title, bpm]);

  const save = async () => {
    if (errors.length) return;
    await db.tasks.add({
      date,
      subjectId: subjectId!,
      itemId,
      segmentId,
      title: title.trim(),
      targetBpm: bpm,
      noteVal,
      done: false,
      createdAt: Date.now(),
    });
    toast.success("Task added");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">New task</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Subject</Label>
            <Select
              value={subjectId?.toString() ?? ""}
              onValueChange={(v) => {
                setSubjectId(Number(v));
                setItemId(undefined);
                setSegmentId(undefined);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Pick a subject" /></SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Library item</Label>
            <Select
              value={itemId?.toString() ?? ""}
              onValueChange={(v) => { setItemId(Number(v)); setSegmentId(undefined); }}
              disabled={!subjectId}
            >
              <SelectTrigger>
                <SelectValue placeholder={subjectId ? "Pick an item" : "Pick a subject first"} />
              </SelectTrigger>
              <SelectContent>
                {itemsForSubject.map((i) => (
                  <SelectItem key={i.id} value={i.id!.toString()}>
                    {i.title}{i.composer ? ` — ${i.composer}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!!segments?.length && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Segment (optional)
              </Label>
              <Select
                value={segmentId?.toString() ?? "none"}
                onValueChange={(v) => setSegmentId(v === "none" ? undefined : Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Whole item —</SelectItem>
                  {segments.map((s) => (
                    <SelectItem key={s.id} value={s.id!.toString()}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
          </div>

          <BpmCoupler
            bpm={bpm}
            noteVal={noteVal}
            onChange={({ bpm: b, noteVal: n }) => { setBpm(b); setNoteVal(n); }}
            label="Target tempo (optional)"
          />

          {errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={errors.length > 0} onClick={save}>
              Add task
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

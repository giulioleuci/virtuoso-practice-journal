import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind, type NoteVal, type Task, type TaskRecurrence } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  /** When editing a recurring template, propagate changes to upcoming siblings. */
}

export function EditTaskSheet({ open, onOpenChange, task }: Props) {
  const subjects = useLiveQuery(() => db.subjects.toArray(), []);
  const library = useLiveQuery(() => db.library.toArray(), []);
  const allTechniques = useLiveQuery(() => db.techniques.toArray(), []);

  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [kindFilter, setKindFilter] = useState<LibraryKind | "all">("all");
  const [itemId, setItemId] = useState<number | undefined>();
  const [segmentId, setSegmentId] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [bpm, setBpm] = useState<number | undefined>();
  const [noteVal, setNoteVal] = useState<NoteVal | undefined>();
  const [layers, setLayers] = useState<string[]>([]);
  const [techniqueIds, setTechniqueIds] = useState<number[]>([]);

  const segments = useLiveQuery(
    () => (itemId ? db.segments.where("itemId").equals(itemId).toArray() : Promise.resolve([])),
    [itemId]
  );
  const itemsForSubject = useMemo(
    () => (library ?? []).filter(
      (l) => l.subjectId === subjectId && (kindFilter === "all" || l.kind === kindFilter)
    ),
    [library, subjectId, kindFilter]
  );

  useEffect(() => {
    if (open && task) {
      setSubjectId(task.subjectId);
      setKindFilter("all");
      setItemId(task.itemId);
      setSegmentId(task.segmentId);
      setTitle(task.title);
      setDate(task.date);
      setBpm(task.targetBpm);
      setNoteVal(task.noteVal);
      setLayers(task.layers ?? []);
      setTechniqueIds(task.techniqueIds ?? []);
    }
  }, [open, task]);

  const subjectLayers = useMemo(
    () => subjects?.find((s) => s.id === subjectId)?.layers ?? [],
    [subjects, subjectId]
  );
  const techniqueOptions = useMemo(
    () => (allTechniques ?? [])
      .filter((t) => t.subjectId === subjectId)
      .map((t) => ({ value: t.id!, label: t.name })),
    [allTechniques, subjectId]
  );

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!subjectId) e.push("Pick a subject");
    if (!title.trim()) e.push("Title is required");
    if (!date) e.push("Date is required");
    if (bpm !== undefined && (bpm < 20 || bpm > 400)) e.push("BPM out of range");
    return e;
  }, [subjectId, title, date, bpm]);

  const save = async () => {
    if (!task?.id || errors.length) return;
    await db.tasks.update(task.id, {
      subjectId: subjectId!, itemId, segmentId,
      title: title.trim(), date, targetBpm: bpm, noteVal,
      layers, techniqueIds,
    });
    toast.success("Task updated");
    onOpenChange(false);
  };

  const KINDS: { val: LibraryKind | "all"; label: string }[] = [
    { val: "all", label: "All" }, { val: "repertoire", label: "Repertoire" },
    { val: "manual", label: "Manuals" }, { val: "technique", label: "Technique" },
    { val: "theory", label: "Theory" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Edit task</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Subject</Label>
            <Select value={subjectId?.toString() ?? ""} onValueChange={(v) => setSubjectId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Pick a subject" /></SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button key={k.val} type="button"
                onClick={() => { setKindFilter(k.val); }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  kindFilter === k.val
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >{k.label}</button>
            ))}
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Library item</Label>
            <Select
              value={itemId?.toString() ?? "none"}
              onValueChange={(v) => { setItemId(v === "none" ? undefined : Number(v)); setSegmentId(undefined); }}
              disabled={!subjectId}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {itemsForSubject.map((i) => (
                  <SelectItem key={i.id} value={i.id!.toString()}>{i.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!!segments?.length && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Segment</Label>
              <Select value={segmentId?.toString() ?? "none"} onValueChange={(v) => setSegmentId(v === "none" ? undefined : Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Whole item —</SelectItem>
                  {segments.map((s) => <SelectItem key={s.id} value={s.id!.toString()}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <BpmCoupler bpm={bpm} noteVal={noteVal} onChange={({ bpm: b, noteVal: n }) => { setBpm(b); setNoteVal(n); }} />

          {errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1" disabled={errors.length > 0} onClick={save}>Save</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Helper exported for Tasks page
export type EditableTaskRecurrence = TaskRecurrence;

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind, type NoteVal } from "@/lib/db";
import { collectionsService } from "@/lib/services";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { RecurrenceFields, buildRecurrence, type RecurrenceState } from "./RecurrenceFields";
import { tasksService } from "@/lib/services";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: string;
  prefill?: {
    subjectId?: number;
    title?: string;
    assignmentId?: number;
  };
  onCreated?: (taskId: number) => void;
}

const KINDS: { val: LibraryKind | "all"; label: string }[] = [
  { val: "all", label: "All" },
  { val: "repertoire", label: "Repertoire" },
  { val: "manual", label: "Manuals" },
  { val: "technique", label: "Technique" },
  { val: "theory", label: "Theory" },
];



export function NewTaskSheet({ open, onOpenChange, date, prefill, onCreated }: Props) {
  const subjects = useLiveQuery(() => db.subjects.toArray(), []);
  const library = useLiveQuery(() => db.library.filter((i) => !i.deletedAt).toArray(), []);
  const allTechniques = useLiveQuery(() => db.techniques.toArray(), []);
  const allCollections = useLiveQuery(() => collectionsService.list(), []);
  const allCollectionItems = useLiveQuery(() => db.collectionItems.toArray(), []);

  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [kindFilter, setKindFilter] = useState<LibraryKind | "all">("all");
  const [collectionFilter, setCollectionFilter] = useState<number | "all">("all");
  const [sortBy, setSortBy] = useState<"title" | "composer">("title");
  const [itemId, setItemId] = useState<number | undefined>();
  const [segmentId, setSegmentId] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState<number | undefined>();
  const [noteVal, setNoteVal] = useState<NoteVal | undefined>();
  const [layers, setLayers] = useState<string[]>([]);
  const [techniqueIds, setTechniqueIds] = useState<number[]>([]);

  // Recurrence
  const [rec, setRecState] = useState<RecurrenceState>({
    enabled: false,
    kind: "weekdays",
    days: [new Date(date).getDay()],
    everyX: 2,
    startDate: date,
    endMode: "never",
    endDate: "",
    occurrences: 10,
  });
  const setRec = (patch: Partial<RecurrenceState>) => setRecState((s) => ({ ...s, ...patch }));

  const itemsForSubject = useMemo(() => {
    const byCollection = new Map<number, Set<number>>();
    for (const link of allCollectionItems ?? []) {
      const set = byCollection.get(link.collectionId) ?? new Set<number>();
      set.add(link.itemId);
      byCollection.set(link.collectionId, set);
    }
    const collectionSet =
      collectionFilter !== "all" ? byCollection.get(collectionFilter) ?? new Set<number>() : null;
    const filtered = (library ?? []).filter((l) => {
      if (l.subjectId !== subjectId) return false;
      if (kindFilter !== "all" && l.kind !== kindFilter) return false;
      if (collectionSet && !collectionSet.has(l.id!)) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sortBy === "composer") {
        const ca = (a.composer ?? "").toLocaleLowerCase();
        const cb = (b.composer ?? "").toLocaleLowerCase();
        const cmp = ca.localeCompare(cb);
        if (cmp !== 0) return cmp;
      }
      return a.title.localeCompare(b.title);
    });
  }, [library, subjectId, kindFilter, collectionFilter, sortBy, allCollectionItems]);
  const segments = useLiveQuery(
    () => (itemId ? db.segments.where("itemId").equals(itemId).toArray() : Promise.resolve([])),
    [itemId]
  );
  const selectedItem = library?.find((l) => l.id === itemId);
  const selectedSegment = segments?.find((s) => s.id === segmentId);

  useEffect(() => {
    if (open) {
      setSubjectId(prefill?.subjectId);
      setKindFilter("all");
      setCollectionFilter("all");
      setSortBy("title");
      setItemId(undefined);
      setSegmentId(undefined);
      setTitle(prefill?.title ?? "");
      setBpm(undefined);
      setNoteVal(undefined);
      setLayers([]);
      setTechniqueIds([]);
      setRecState({
        enabled: false,
        kind: "weekdays",
        days: [new Date(date).getDay()],
        everyX: 2,
        startDate: date,
        endMode: "never",
        endDate: "",
        occurrences: 10,
      });
    }
  }, [open, prefill?.subjectId, prefill?.title, date]);

  useEffect(() => {
    if (!selectedItem) return;
    const segLabel = selectedSegment ? ` — ${selectedSegment.label}` : "";
    setTitle(`${selectedItem.title}${segLabel}`);
    setBpm(selectedSegment?.targetBpm ?? selectedItem.targetBpm);
    setNoteVal(selectedSegment?.noteVal ?? selectedItem.noteVal);
    // Pre-seed techniques from item/segment association
    setTechniqueIds(selectedSegment?.techniqueIds ?? selectedItem.techniqueIds ?? []);
    setLayers(selectedSegment?.layers ?? []);
  }, [itemId, segmentId, selectedItem, selectedSegment]);

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

  // Next lesson date for the selected subject (strictly after startDate)
  const lessons = useLiveQuery(() => db.lessons.toArray(), []);
  const lessonRecurrences = useLiveQuery(() => db.recurrences.toArray(), []);
  const nextLessonDate = useMemo(() => {
    if (!subjectId) return undefined;
    const candidates: string[] = [];
    for (const l of lessons ?? []) {
      if (l.subjectId === subjectId && l.date > rec.startDate) candidates.push(l.date);
    }
    for (const r of lessonRecurrences ?? []) {
      if (r.subjectId !== subjectId) continue;
      const start = new Date(rec.startDate);
      for (let i = 1; i <= 365; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        if (d.getDay() !== r.dayOfWeek) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (r.endDate && key > r.endDate) break;
        if (r.frequency === "biweekly") {
          const weeks = Math.floor((d.getTime() - new Date(r.startDate).getTime()) / (7 * 86400000));
          if (weeks % 2 !== 0) continue;
        } else if (r.frequency === "monthly") {
          const days = Math.floor((d.getTime() - new Date(r.startDate).getTime()) / 86400000);
          if (days % 28 !== 0) continue;
        }
        candidates.push(key);
        break;
      }
    }
    candidates.sort();
    return candidates[0];
  }, [lessons, lessonRecurrences, subjectId, rec.startDate]);

  const recurrence = useMemo(() => buildRecurrence(rec, nextLessonDate), [rec, nextLessonDate]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!subjectId) e.push("Pick a subject");
    if (!itemId) e.push("Pick a library item");
    if (!title.trim()) e.push("Title is required");
    if (bpm !== undefined && (bpm < 20 || bpm > 400)) e.push("BPM out of range");
    if (rec.enabled) {
      if (rec.kind === "weekdays" && !rec.days.length) e.push("Pick at least one day");
      if (rec.kind === "interval" && (rec.everyX < 1 || rec.everyX > 60)) e.push("Interval must be 1–60 days");
      if (rec.endMode === "date" && !rec.endDate) e.push("Set an end date");
      if (rec.endMode === "nextLesson" && !nextLessonDate) e.push("No upcoming lesson found for this subject");
      if (rec.endMode === "count" && (rec.occurrences < 1 || rec.occurrences > 200)) e.push("Occurrences must be 1–200");
    }
    return e;
  }, [subjectId, itemId, title, bpm, rec, nextLessonDate]);

  const save = async () => {
    if (errors.length) return;
    const baseTask = {
      subjectId: subjectId!,
      itemId,
      segmentId,
      title: title.trim(),
      targetBpm: bpm,
      noteVal,
      layers,
      techniqueIds,
    };
    try {
      const firstId = await tasksService.create({
        ...baseTask,
        date: recurrence ? recurrence.startDate : date,
        recurrence,
      });
      if (prefill?.assignmentId) {
        await db.assignments.update(prefill.assignmentId, { transformed: true, taskId: firstId });
      }
      toast.success(recurrence ? "Recurring task created" : "Task added");
      onCreated?.(firstId);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">New task</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Subject</Label>
            <Select
              value={subjectId?.toString() ?? ""}
              onValueChange={(v) => { setSubjectId(Number(v)); setItemId(undefined); setSegmentId(undefined); }}
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
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Filter by kind</Label>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.val}
                  type="button"
                  onClick={() => { setKindFilter(k.val); setItemId(undefined); setSegmentId(undefined); }}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-colors",
                    kindFilter === k.val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >{k.label}</button>
              ))}
            </div>
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
                {itemsForSubject.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No items</div>
                )}
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
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Segment (optional)</Label>
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

          <MultiChipPicker
            label="Layers to practice"
            options={subjectLayers.map((l) => ({ value: l, label: l }))}
            value={layers}
            onChange={setLayers}
            emptyHint="Define this subject's layers in Profile."
          />
          <MultiChipPicker
            label="Techniques to focus"
            options={techniqueOptions}
            value={techniqueIds}
            onChange={setTechniqueIds}
            emptyHint="Add techniques in Profile."
          />

          <RecurrenceFields state={rec} setState={setRec} nextLessonDate={nextLessonDate} />

          {errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1" disabled={errors.length > 0} onClick={save}>
              Add task
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

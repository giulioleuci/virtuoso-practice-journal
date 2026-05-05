import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind, type NoteVal, type TaskRecurrence } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { expandTaskRecurrence, schoolYearEnd } from "@/lib/recurrence";
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

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function NewTaskSheet({ open, onOpenChange, date, prefill, onCreated }: Props) {
  const subjects = useLiveQuery(() => db.subjects.toArray(), []);
  const library = useLiveQuery(() => db.library.toArray(), []);
  const allTechniques = useLiveQuery(() => db.techniques.toArray(), []);

  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [kindFilter, setKindFilter] = useState<LibraryKind | "all">("all");
  const [itemId, setItemId] = useState<number | undefined>();
  const [segmentId, setSegmentId] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState<number | undefined>();
  const [noteVal, setNoteVal] = useState<NoteVal | undefined>();
  const [layers, setLayers] = useState<string[]>([]);
  const [techniqueIds, setTechniqueIds] = useState<number[]>([]);

  // Recurrence
  const [repeat, setRepeat] = useState(false);
  const [recKind, setRecKind] = useState<"weekdays" | "interval">("weekdays");
  const [recDays, setRecDays] = useState<number[]>([new Date(date).getDay()]);
  const [everyX, setEveryX] = useState(2);
  const [startDate, setStartDate] = useState(date);
  const [endMode, setEndMode] = useState<"never" | "nextLesson" | "date" | "count">("never");
  const [endDate, setEndDate] = useState("");
  const [occurrences, setOccurrences] = useState(10);

  const itemsForSubject = useMemo(
    () => (library ?? []).filter(
      (l) => l.subjectId === subjectId && (kindFilter === "all" || l.kind === kindFilter)
    ),
    [library, subjectId, kindFilter]
  );
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
      setItemId(undefined);
      setSegmentId(undefined);
      setTitle(prefill?.title ?? "");
      setBpm(undefined);
      setNoteVal(undefined);
      setLayers([]);
      setTechniqueIds([]);
      setRepeat(false);
      setRecKind("weekdays");
      setRecDays([new Date(date).getDay()]);
      setEveryX(2);
      setStartDate(date);
      setEndMode("never");
      setEndDate("");
      setOccurrences(10);
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
      if (l.subjectId === subjectId && l.date > startDate) candidates.push(l.date);
    }
    // Also project upcoming dates from recurrences
    for (const r of lessonRecurrences ?? []) {
      if (r.subjectId !== subjectId) continue;
      // simple weekly/biweekly projection within a year
      const start = new Date(startDate);
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
          // approx every 4 weeks from startDate
          const days = Math.floor((d.getTime() - new Date(r.startDate).getTime()) / 86400000);
          if (days % 28 !== 0) continue;
        }
        candidates.push(key);
        break;
      }
    }
    candidates.sort();
    return candidates[0];
  }, [lessons, lessonRecurrences, subjectId, startDate]);

  const recurrence: TaskRecurrence | undefined = useMemo(() => {
    if (!repeat) return undefined;
    return {
      kind: recKind,
      days: recKind === "weekdays" ? [...recDays].sort() : undefined,
      everyXDays: recKind === "interval" ? everyX : undefined,
      startDate,
      endDate:
        endMode === "date" && endDate
          ? endDate
          : endMode === "nextLesson" && nextLessonDate
          ? nextLessonDate
          : endMode === "never"
          ? schoolYearEnd(new Date())
          : undefined,
      occurrences: endMode === "count" ? occurrences : undefined,
    };
  }, [repeat, recKind, recDays, everyX, startDate, endMode, endDate, occurrences, nextLessonDate]);

  const previewDates = useMemo(
    () => (recurrence ? expandTaskRecurrence(recurrence).slice(0, 6) : []),
    [recurrence]
  );

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!subjectId) e.push("Pick a subject");
    if (!itemId) e.push("Pick a library item");
    if (!title.trim()) e.push("Title is required");
    if (bpm !== undefined && (bpm < 20 || bpm > 400)) e.push("BPM out of range");
    if (repeat) {
      if (recKind === "weekdays" && !recDays.length) e.push("Pick at least one day");
      if (recKind === "interval" && (everyX < 1 || everyX > 60)) e.push("Interval must be 1–60 days");
      if (endMode === "date" && !endDate) e.push("Set an end date");
      if (endMode === "count" && (occurrences < 1 || occurrences > 200)) e.push("Occurrences must be 1–200");
    }
    return e;
  }, [subjectId, itemId, title, bpm, repeat, recKind, recDays, everyX, endMode, endDate, occurrences]);

  const toggleDay = (d: number) =>
    setRecDays((arr) => (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]));

  const save = async () => {
    if (errors.length) return;
    const now = Date.now();
    const baseTask = {
      subjectId: subjectId!,
      itemId,
      segmentId,
      title: title.trim(),
      targetBpm: bpm,
      noteVal,
      layers,
      techniqueIds,
      done: false,
      createdAt: now,
    };

    let firstId: number;
    if (recurrence) {
      const dates = expandTaskRecurrence(recurrence);
      if (!dates.length) {
        toast.error("Recurrence produced no dates");
        return;
      }
      await db.transaction("rw", db.tasks, db.assignments, async () => {
        firstId = (await db.tasks.add({
          ...baseTask,
          date: dates[0],
          recurrence,
        })) as number;
        if (dates.length > 1) {
          await db.tasks.bulkAdd(
            dates.slice(1).map((d) => ({ ...baseTask, date: d, recurrenceTaskId: firstId }))
          );
        }
        if (prefill?.assignmentId) {
          await db.assignments.update(prefill.assignmentId, { transformed: true, taskId: firstId });
        }
      });
      toast.success(`Created ${dates.length} occurrences`);
    } else {
      firstId = (await db.tasks.add({ ...baseTask, date })) as number;
      if (prefill?.assignmentId) {
        await db.assignments.update(prefill.assignmentId, { transformed: true, taskId: firstId });
      }
      toast.success("Task added");
    }
    onCreated?.(firstId!);
    onOpenChange(false);
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

          <div className="paper-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Repeat</div>
                <div className="text-xs text-muted-foreground">Generate this task on a schedule</div>
              </div>
              <Switch checked={repeat} onCheckedChange={setRepeat} />
            </div>

            {repeat && (
              <div className="space-y-3 pt-1">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Start date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pattern</Label>
                  <Select value={recKind} onValueChange={(v) => setRecKind(v as typeof recKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekdays">Specific days of week</SelectItem>
                      <SelectItem value="interval">Every X days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {recKind === "weekdays" ? (
                  <div className="flex justify-between gap-1">
                    {DAYS.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={cn(
                          "flex-1 h-9 rounded-md text-sm font-medium transition-colors",
                          recDays.includes(i)
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent/50 text-muted-foreground hover:bg-accent"
                        )}
                      >{d}</button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Every</span>
                    <Input
                      type="number" min={1} max={60}
                      value={everyX}
                      onChange={(e) => setEveryX(Number(e.target.value) || 1)}
                      className="w-20 tabular-nums"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ends</Label>
                  <Select value={endMode} onValueChange={(v) => setEndMode(v as typeof endMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">End of school year (Jun 30)</SelectItem>
                      <SelectItem value="date">On a date</SelectItem>
                      <SelectItem value="count">After N occurrences</SelectItem>
                    </SelectContent>
                  </Select>
                  {endMode === "date" && (
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  )}
                  {endMode === "count" && (
                    <Input
                      type="number" min={1} max={200}
                      value={occurrences}
                      onChange={(e) => setOccurrences(Number(e.target.value) || 1)}
                      className="w-24 tabular-nums"
                    />
                  )}
                </div>

                {previewDates.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Next: {previewDates.join(", ")}
                    {recurrence && expandTaskRecurrence(recurrence).length > previewDates.length && "…"}
                  </p>
                )}
              </div>
            )}
          </div>

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

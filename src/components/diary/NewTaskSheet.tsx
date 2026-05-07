import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type NoteVal, type TaskLinkType } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { LinkTargetFields } from "./LinkTargetFields";
import { RecurrenceFields, buildRecurrence, type RecurrenceState } from "./RecurrenceFields";
import { tasksService } from "@/lib/services";
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

export function NewTaskSheet({ open, onOpenChange, date, prefill, onCreated }: Props) {
  const { t } = useI18n();
  const subjects = useLiveQuery(() => db.subjects.toArray(), []);
  const allTechniques = useLiveQuery(() => db.techniques.toArray(), []);

  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [linkType, setLinkType] = useState<TaskLinkType>("free");
  const [itemId, setItemId] = useState<number | undefined>();
  const [segmentIds, setSegmentIds] = useState<number[]>([]);
  const [collectionId, setCollectionId] = useState<number | undefined>();
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

  const selectedItem = useLiveQuery(
    () => (itemId ? db.library.get(itemId) : Promise.resolve(undefined)),
    [itemId]
  );
  const selectedSegments = useLiveQuery(
    () => (segmentIds.length ? db.segments.where("id").anyOf(segmentIds).toArray() : Promise.resolve([])),
    [segmentIds.join(",")]
  );
  const selectedCollection = useLiveQuery(
    () => (collectionId ? db.collections.get(collectionId) : Promise.resolve(undefined)),
    [collectionId]
  );

  useEffect(() => {
    if (open) {
      setSubjectId(prefill?.subjectId);
      setLinkType("free");
      setItemId(undefined);
      setSegmentIds([]);
      setCollectionId(undefined);
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

  // Auto-fill title/BPM/layers from item or segments selection
  useEffect(() => {
    if (linkType !== "item" || !selectedItem) return;
    const segLabel = selectedSegments?.length === 1
      ? ` — ${selectedSegments[0].label}`
      : selectedSegments && selectedSegments.length > 1
        ? ` — ${selectedSegments.length} segments`
        : "";
    setTitle(`${selectedItem.title}${segLabel}`);
    const firstSeg = selectedSegments?.[0];
    setBpm(firstSeg?.targetBpm ?? selectedItem.targetBpm);
    setNoteVal(firstSeg?.noteVal ?? selectedItem.noteVal);
    setTechniqueIds(firstSeg?.techniqueIds ?? selectedItem.techniqueIds ?? []);
    setLayers(firstSeg?.layers ?? []);
  }, [linkType, itemId, segmentIds.join(","), selectedItem, selectedSegments]);

  // Auto-fill title from collection
  useEffect(() => {
    if (linkType !== "collection" || !selectedCollection) return;
    setTitle(selectedCollection.name);
  }, [linkType, collectionId, selectedCollection]);

  const subjectLayers = useMemo(
    () => subjects?.find((s) => s.id === subjectId)?.layers ?? [],
    [subjects, subjectId]
  );
  const techniqueOptions = useMemo(
    () => (allTechniques ?? [])
      .filter((tech) => tech.subjectId === subjectId)
      .map((tech) => ({ value: tech.id!, label: tech.name })),
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
    if (!subjectId) e.push(t("errors.pickSubject"));
    if (linkType === "item" && !itemId) e.push(t("errors.pickItem"));
    if (linkType === "collection" && !collectionId) e.push(t("errors.pickCollection"));
    if (!title.trim()) e.push(t("errors.titleRequired"));
    if (bpm !== undefined && (bpm < 20 || bpm > 400)) e.push(t("errors.bpmRange"));
    if (rec.enabled) {
      if (rec.kind === "weekdays" && !rec.days.length) e.push(t("errors.pickOneDay"));
      if (rec.kind === "interval" && (rec.everyX < 1 || rec.everyX > 60)) e.push(t("errors.intervalRange"));
      if (rec.endMode === "date" && !rec.endDate) e.push(t("errors.setEndDate"));
      if (rec.endMode === "nextLesson" && !nextLessonDate) e.push(t("errors.noUpcomingLesson"));
      if (rec.endMode === "count" && (rec.occurrences < 1 || rec.occurrences > 200)) e.push(t("errors.occurrencesRange"));
    }
    return e;
  }, [subjectId, linkType, itemId, collectionId, title, bpm, rec, nextLessonDate, t]);

  const save = async () => {
    if (errors.length) return;
    const baseTask = {
      subjectId: subjectId!,
      linkType,
      itemId: linkType === "item" ? itemId : undefined,
      segmentIds: linkType === "item" ? segmentIds : undefined,
      collectionId: linkType === "collection" ? collectionId : undefined,
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
      toast.success(recurrence ? t("toast.recurringTaskCreated") : t("toast.taskAdded"));
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
          <SheetTitle className="font-serif text-2xl">{t("tasks.newTask")}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.subject")}</Label>
            <Select
              value={subjectId?.toString() ?? ""}
              onValueChange={(v) => {
                setSubjectId(Number(v));
                setItemId(undefined); setSegmentIds([]); setCollectionId(undefined);
              }}
            >
              <SelectTrigger><SelectValue placeholder={t("tasks.pickSubject")} /></SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <LinkTargetFields
            subjectId={subjectId}
            linkType={linkType}
            setLinkType={setLinkType}
            itemId={itemId}
            setItemId={setItemId}
            segmentIds={segmentIds}
            setSegmentIds={setSegmentIds}
            collectionId={collectionId}
            setCollectionId={setCollectionId}
          />

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("common.title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("tasks.taskTitle")} />
          </div>

          <BpmCoupler
            bpm={bpm}
            noteVal={noteVal}
            onChange={({ bpm: b, noteVal: n }) => { setBpm(b); setNoteVal(n); }}
            label={t("tasks.targetTempo")}
          />

          <MultiChipPicker
            label={t("tasks.layersToPractice")}
            options={subjectLayers.map((l) => ({ value: l, label: l }))}
            value={layers}
            onChange={setLayers}
            emptyHint={t("tasks.defineLayersHint")}
          />
          <MultiChipPicker
            label={t("tasks.techniquesToFocus")}
            options={techniqueOptions}
            value={techniqueIds}
            onChange={setTechniqueIds}
            emptyHint={t("tasks.addTechniquesHint")}
          />

          <RecurrenceFields state={rec} setState={setRec} nextLessonDate={nextLessonDate} />

          {errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button className="flex-1" disabled={errors.length > 0} onClick={save}>
              {t("tasks.addTask")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

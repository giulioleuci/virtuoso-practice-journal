/**
 * 3-step task creation wizard:
 * Step 1 "What": Subject + link type + item/collection picker
 * Step 2 "How": Title + BPM + layers + techniques
 * Step 3 "When": Recurrence
 *
 * A persistent summary chip bar shows selections from previous steps.
 */
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, THEORY_LAYERS, type NoteVal, type TaskLinkType } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { LinkTargetFields } from "./LinkTargetFields";
import { RecurrenceFields, buildRecurrence, type RecurrenceState } from "./RecurrenceFields";
import { tasksService, lessonsService } from "@/lib/services";
import { useFormDraft } from "@/hooks/useFormDraft";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CompleteIcon } from "@/lib/icons";

const STEPS = ["What", "How", "When"] as const;
type Step = 1 | 2 | 3;

interface Props {
  date: string;
  prefill?: {
    subjectId?: number;
    title?: string;
    itemId?: number;
    itemTitle?: string;
    itemSubjectId?: number;
    itemBpm?: number;
    itemNoteVal?: NoteVal;
    assignmentId?: number;
  };
  onCreated?: (taskId: number) => void;
  onCancel: () => void;
}

export function TaskWizard({ date, prefill, onCreated, onCancel }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>(1);
  const draft = useFormDraft(`task-wizard-${date}`, {});

  const subjects = useLiveQuery(() => db.subjects.filter((s) => !s.deletedAt).toArray(), []);
  const allTechniques = useLiveQuery(() => db.techniques.toArray(), []);
  const lessons = useLiveQuery(() => db.lessons.toArray(), []);
  const lessonRecurrences = useLiveQuery(() => db.recurrences.toArray(), []);

  // Step 1 state
  const [subjectId, setSubjectId] = useState<number | undefined>(prefill?.itemSubjectId ?? prefill?.subjectId);
  const [linkType, setLinkType] = useState<TaskLinkType>(prefill?.itemId ? "item" : "free");
  const [itemId, setItemId] = useState<number | undefined>(prefill?.itemId);
  const [segmentIds, setSegmentIds] = useState<number[]>([]);
  const [collectionId, setCollectionId] = useState<number | undefined>();

  // Step 2 state
  const [title, setTitle] = useState(prefill?.itemTitle ?? prefill?.title ?? "");
  const [bpm, setBpm] = useState<number | undefined>(prefill?.itemBpm);
  const [noteVal, setNoteVal] = useState<NoteVal | undefined>(prefill?.itemNoteVal);
  const [layers, setLayers] = useState<string[]>([]);
  const [techniqueIds, setTechniqueIds] = useState<number[]>([]);

  // Step 3 state
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

  const selectedSubject = useMemo(
    () => subjects?.find((s) => s.id === subjectId),
    [subjects, subjectId]
  );
  const isTheorySubject = selectedSubject?.type === "theory";
  const subjectLayers = useMemo(
    () => isTheorySubject ? [...THEORY_LAYERS] : (selectedSubject?.layers ?? []),
    [selectedSubject, isTheorySubject]
  );
  const techniqueOptions = useMemo(
    () => (allTechniques ?? [])
      .filter((tech) => tech.subjectId === subjectId)
      .map((tech) => ({ value: tech.id!, label: tech.name })),
    [allTechniques, subjectId]
  );

  // Auto-fill title/BPM/layers from selected item
  const segmentIdsKey = segmentIds.join(",");
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
  }, [linkType, itemId, segmentIdsKey, selectedItem, selectedSegments]);

  useEffect(() => {
    if (linkType !== "collection" || !selectedCollection) return;
    setTitle(selectedCollection.name);
  }, [linkType, collectionId, selectedCollection]);

  const nextLessonDate = useMemo(() => {
    if (!subjectId) return undefined;
    const candidates: string[] = [];
    for (const l of lessons ?? []) {
      if (l.subjectId === subjectId && l.date > rec.startDate) candidates.push(l.date);
    }
    for (const r of lessonRecurrences ?? []) {
      if (r.subjectId !== subjectId) continue;
      const start = new Date(rec.startDate);
      const d = new Date(start);
      d.setDate(d.getDate() + 1);
      const daysToAdd = (r.dayOfWeek - d.getDay() + 7) % 7;
      d.setDate(d.getDate() + daysToAdd);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (r.endDate && key > r.endDate) continue;
      if (Math.round((d.getTime() - start.getTime()) / 86400000) <= 365) candidates.push(key);
    }
    candidates.sort();
    return candidates[0];
  }, [lessons, lessonRecurrences, subjectId, rec.startDate]);

  const recurrence = useMemo(() => buildRecurrence(rec, nextLessonDate), [rec, nextLessonDate]);

  // Validation per step
  const step1Errors = useMemo(() => {
    const e: string[] = [];
    if (!subjectId) e.push(t("errors.pickSubject"));
    if (linkType === "item" && !itemId) e.push(t("errors.pickItem"));
    if (linkType === "collection" && !collectionId) e.push(t("errors.pickCollection"));
    return e;
  }, [subjectId, linkType, itemId, collectionId, t]);

  const step2Errors = useMemo(() => {
    const e: string[] = [];
    if (!title.trim()) e.push(t("errors.titleRequired"));
    if (bpm !== undefined && (bpm < 20 || bpm > 400)) e.push(t("errors.bpmRange"));
    return e;
  }, [title, bpm, t]);

  const step3Errors = useMemo(() => {
    const e: string[] = [];
    if (rec.enabled) {
      if (rec.kind === "weekdays" && !rec.days.length) e.push(t("errors.pickOneDay"));
      if (rec.kind === "interval" && (rec.everyX < 1 || rec.everyX > 60)) e.push(t("errors.intervalRange"));
      if (rec.endMode === "date" && !rec.endDate) e.push(t("errors.setEndDate"));
      if (rec.endMode === "nextLesson" && !nextLessonDate) e.push(t("errors.noUpcomingLesson"));
      if (rec.endMode === "count" && (rec.occurrences < 1 || rec.occurrences > 200)) e.push(t("errors.occurrencesRange"));
    }
    return e;
  }, [rec, nextLessonDate, t]);

  // Summary chips
  const summaryChips = useMemo(() => {
    const chips: string[] = [];
    if (selectedSubject) chips.push(selectedSubject.name);
    if (selectedItem) chips.push(selectedItem.title);
    if (selectedCollection) chips.push(selectedCollection.name);
    if (title) chips.push(title);
    if (bpm) chips.push(`♩ = ${bpm}`);
    return chips;
  }, [selectedSubject, selectedItem, selectedCollection, title, bpm]);

  const save = async () => {
    if (step1Errors.length || step2Errors.length || step3Errors.length) return;
    const baseTask = {
      subjectId: subjectId!,
      linkType,
      itemId: linkType === "item" ? itemId : undefined,
      segmentIds: linkType === "item" ? segmentIds : undefined,
      collectionId: linkType === "collection" ? collectionId : undefined,
      title: title.trim(),
      targetBpm: bpm,
      noteVal,
      layers: isTheorySubject ? [...THEORY_LAYERS] : layers,
      techniqueIds,
    };
    try {
      const firstId = await tasksService.create({
        ...baseTask,
        date: recurrence ? recurrence.startDate : date,
        recurrence,
      });
      if (prefill?.assignmentId) {
        await lessonsService.transformAssignment(prefill.assignmentId, firstId);
      }
      draft.clearDraft();
      toast.success(recurrence ? t("toast.recurringTaskCreated") : t("toast.taskAdded"));
      onCreated?.(firstId);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const canProceed = step === 1 ? !step1Errors.length : step === 2 ? !step2Errors.length : !step3Errors.length;

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-1">
        {STEPS.map((label, i) => {
          const stepNum = (i + 1) as Step;
          const done = step > stepNum;
          const active = step === stepNum;
          return (
            <button
              key={label}
              type="button"
              onClick={() => { if (done || active) setStep(stepNum); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all",
                active && "bg-primary text-primary-foreground",
                done && "text-primary cursor-pointer",
                !active && !done && "text-muted-foreground cursor-default"
              )}
            >
              {done ? (
                <CompleteIcon className="h-3 w-3" />
              ) : (
                <span className={cn(
                  "h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold",
                  active ? "bg-primary-foreground text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {stepNum}
                </span>
              )}
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Summary chips from previous steps */}
      {summaryChips.length > 0 && step > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {summaryChips.map((chip) => (
            <span key={chip} className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary truncate max-w-[200px]">
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* Step 1: What */}
      {step === 1 && (
        <div className="space-y-4">
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

          {subjectId && (
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
          )}

          {step1Errors.length > 0 && step !== 1 && (
            <ul className="text-xs text-destructive">
              {step1Errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Step 2: How */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("common.title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("tasks.taskTitle")} />
          </div>

          {!isTheorySubject && (
            <BpmCoupler
              bpm={bpm}
              noteVal={noteVal}
              onChange={({ bpm: b, noteVal: n }) => { setBpm(b); setNoteVal(n); }}
              label={t("tasks.targetTempo")}
            />
          )}

          {!isTheorySubject && (
            <MultiChipPicker
              label={t("tasks.layersToPractice")}
              options={subjectLayers.map((l) => ({ value: l, label: l }))}
              value={layers}
              onChange={setLayers}
              emptyHint={t("tasks.defineLayersHint")}
            />
          )}

          <MultiChipPicker
            label={t("tasks.techniquesToFocus")}
            options={techniqueOptions}
            value={techniqueIds}
            onChange={setTechniqueIds}
            emptyHint={t("tasks.addTechniquesHint")}
          />

          {step2Errors.length > 0 && (
            <ul className="text-xs text-destructive">
              {step2Errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Step 3: When */}
      {step === 3 && (
        <div className="space-y-4">
          <RecurrenceFields state={rec} setState={setRec} nextLessonDate={nextLessonDate} />

          {step3Errors.length > 0 && (
            <ul className="text-xs text-destructive">
              {step3Errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            if (step === 1) onCancel();
            else setStep((s) => (s - 1) as Step);
          }}
        >
          {step === 1 ? t("common.cancel") : t("common.back")}
        </Button>
        {step < 3 ? (
          <Button
            className="flex-1"
            disabled={!canProceed}
            onClick={() => setStep((s) => (s + 1) as Step)}
          >
            {t("common.next")}
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={!canProceed}
            onClick={save}
          >
            {t("tasks.addTask")}
          </Button>
        )}
      </div>
    </div>
  );
}

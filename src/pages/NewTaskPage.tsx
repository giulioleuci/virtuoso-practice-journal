import { useEffect, useMemo, useState } from "react";
import { useLessons, useRecurrences, useSubjects, useTechniques, useItem } from "@/hooks/useEntities";
import { useNavigate, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, THEORY_LAYERS, type NoteVal, type TaskLinkType } from "@/lib/db";
import { getSubjectLayers } from "@/lib/domain/subjectLayers";
import { nextLessonDate } from "@/lib/domain/lessonSchedule";
import { useI18n } from "@/lib/i18n";
import { today } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { LinkTargetFields } from "@/components/diary/LinkTargetFields";
import { RecurrenceFields } from "@/components/diary/RecurrenceFields";
import { buildRecurrence, type RecurrenceState } from "@/components/diary/recurrence-state";
import { StudyRoutineWizard } from "@/components/diary/StudyRoutineWizard";
import { TaskWizard } from "@/components/diary/TaskWizard";
import { tasksService, lessonsService } from "@/lib/services";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

interface LocationState {
  date?: string;
  prefill?: {
    subjectId?: number;
    title?: string;
    assignmentId?: number;
    itemId?: number;
    itemTitle?: string;
    itemSubjectId?: number;
    itemBpm?: number;
    itemNoteVal?: NoteVal;
  };
}

export default function NewTaskPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) ?? {};
  const date = state.date ?? today();
  const prefill = state.prefill;

  const subjects = useSubjects();
  const allTechniques = useTechniques();

  const [activeTab, setActiveTab] = useState<"standard" | "wizard" | "routine">("standard");
  const [subjectId, setSubjectId] = useState<number | undefined>(prefill?.itemSubjectId ?? prefill?.subjectId);
  const [linkType, setLinkType] = useState<TaskLinkType>(prefill?.itemId ? "item" : "free");
  const [itemId, setItemId] = useState<number | undefined>(prefill?.itemId);
  const [segmentIds, setSegmentIds] = useState<number[]>([]);
  const [collectionId, setCollectionId] = useState<number | undefined>();
  const [title, setTitle] = useState(prefill?.itemTitle ?? prefill?.title ?? "");
  const [bpm, setBpm] = useState<number | undefined>(prefill?.itemBpm);
  const [noteVal, setNoteVal] = useState<NoteVal | undefined>(prefill?.itemNoteVal);
  const [layers, setLayers] = useState<string[]>([]);
  const [techniqueIds, setTechniqueIds] = useState<number[]>([]);

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

  const selectedItem = useItem(itemId);
  const selectedSegments = useLiveQuery(
    () => (segmentIds.length ? db.segments.where("id").anyOf(segmentIds).toArray() : Promise.resolve([])),
    [segmentIds.join(",")]
  );
  const selectedCollection = useLiveQuery(
    () => (collectionId ? db.collections.get(collectionId) : Promise.resolve(undefined)),
    [collectionId]
  );

  // Auto-fill title/BPM/layers from item or segments selection
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

  // Auto-fill title from collection
  useEffect(() => {
    if (linkType !== "collection" || !selectedCollection) return;
    setTitle(selectedCollection.name);
  }, [linkType, collectionId, selectedCollection]);

  const selectedSubject = useMemo(
    () => subjects?.find((s) => s.id === subjectId),
    [subjects, subjectId]
  );
  const isTheorySubject = selectedSubject?.type === "theory";
  const subjectLayers = useMemo(
    () => getSubjectLayers(selectedSubject),
    [selectedSubject],
  );
  const techniqueOptions = useMemo(
    () => (allTechniques ?? [])
      .filter((tech) => tech.subjectId === subjectId)
      .map((tech) => ({ value: tech.id, label: tech.name })),
    [allTechniques, subjectId]
  );

  const lessons = useLessons();
  const lessonRecurrences = useRecurrences();
  const nextLessonDateValue = useMemo(() => {
    if (!subjectId) return undefined;
    return nextLessonDate(lessonRecurrences ?? [], {
      subjectId,
      after: rec.startDate,
      lessons: lessons ?? [],
    });
  }, [lessons, lessonRecurrences, subjectId, rec.startDate]);

  const recurrence = useMemo(() => buildRecurrence(rec, nextLessonDateValue), [rec, nextLessonDateValue]);

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
      if (rec.endMode === "nextLesson" && !nextLessonDateValue) e.push(t("errors.noUpcomingLesson"));
      if (rec.endMode === "count" && (rec.occurrences < 1 || rec.occurrences > 200)) e.push(t("errors.occurrencesRange"));
    }
    return e;
  }, [subjectId, linkType, itemId, collectionId, title, bpm, rec, nextLessonDateValue, t]);

  const handleCancel = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const save = async () => {
    if (errors.length || subjectId === undefined) return;
    const baseTask = {
      subjectId,
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
      toast.success(recurrence ? t("toast.recurringTaskCreated") : t("toast.taskAdded"));
      handleCancel();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="text-muted-foreground hover:text-foreground"
          aria-label={t("common.back")}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="font-serif text-3xl flex-1">{t("tasks.newTask")}</h2>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1.5 flex-wrap">
        {(["standard", "wizard", "routine"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              activeTab === tab
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "wizard" ? t("studyRoutine.tab.wizard") : t(`studyRoutine.tab.${tab}`)}
          </button>
        ))}
      </div>

      {/* Subject picker — shared between standard/routine tabs */}
      {activeTab !== "wizard" && (
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
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {activeTab === "routine" ? (
        <StudyRoutineWizard
          subjectId={subjectId}
          date={date}
          onCreated={() => navigate("/")}
          onCancel={handleCancel}
        />
      ) : activeTab === "wizard" ? (
        <TaskWizard
          date={date}
          prefill={prefill}
          onCreated={() => handleCancel()}
          onCancel={handleCancel}
        />
      ) : (
        <>
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

          <RecurrenceFields state={rec} setState={setRec} nextLessonDate={nextLessonDateValue} />

          {errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleCancel}>{t("common.cancel")}</Button>
            <Button className="flex-1" disabled={errors.length > 0} onClick={save}>
              {t("tasks.addTask")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

import { TempoProgressionFields } from "@/components/diary/TempoProgressionFields";
import type { TempoProgressionRule } from "@/domain/entities/tempoProgression";
import { bpmSchema, tempoRuleSchema } from "@/lib/schemas";
import { useEffect, useMemo, useState } from "react";
import { useCollection, useItem, useLessons, useRecurrences, useSegmentsByIds, useSubjects } from "@/presentation/hooks/useEntities";
import { useNavigate, useLocation } from "react-router-dom";
import type { TaskImportance, TaskLinkType } from "@/domain/entities/task";
import { nextLessonDate } from "@/lib/domain/lessonSchedule";
import { useI18n } from "@/lib/i18n";
import { today } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PlanEditor } from "@/components/diary/PlanEditor";
import { ImportanceSelect } from "@/components/diary/ImportanceSelect";
import { useTaskPlan } from "@/components/diary/useTaskPlan";
import { LinkTargetFields } from "@/components/diary/LinkTargetFields";
import { RecurrenceFields } from "@/components/diary/RecurrenceFields";
import { buildRecurrence, type RecurrenceState } from "@/components/diary/recurrence-state";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormErrors } from "@/components/shared/StateNotice";
import { FloatingActions } from "@/components/shared/FloatingActions";

import { tasksService, lessonsService } from "@/lib/services";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";

interface LocationState {
  date?: string;
  prefill?: {
    subjectId?: number;
    title?: string;
    assignmentId?: number;
    collectionId?: number;
    itemId?: number;
    itemTitle?: string;
    itemSubjectId?: number;
    segmentIds?: number[];
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

  const [subjectId, setSubjectId] = useState<number | undefined>(prefill?.itemSubjectId ?? prefill?.subjectId);
  const [linkType, setLinkType] = useState<TaskLinkType>(prefill?.collectionId ? "collection" : "item");
  const [itemId, setItemId] = useState<number | undefined>(prefill?.itemId);
  const [segmentIds, setSegmentIds] = useState<number[]>(prefill?.segmentIds ?? []);
  const [collectionId, setCollectionId] = useState<number | undefined>(prefill?.collectionId);
  const [importance, setImportance] = useState<TaskImportance>("medium");
  const [title, setTitle] = useState(prefill?.itemTitle ?? prefill?.title ?? "");
  // Once the musician types a title, picking material or sections no longer rewrites it.
  const [titleTouched, setTitleTouched] = useState(false);
  const [executionNotes, setExecutionNotes] = useState("");

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
  const selectedSegments = useSegmentsByIds(segmentIds);
  const selectedCollection = useCollection(collectionId);

  const selectedSubject = useMemo(
    () => subjects?.find((s) => s.id === subjectId),
    [subjects, subjectId]
  );
  const [plan, setPlan] = useTaskPlan([], { linkType, itemId, segmentIds }, selectedItem, selectedSegments, selectedSubject);

  // Auto-fill title from item or segments selection
  const segmentIdsKey = segmentIds.join(",");
  useEffect(() => {
    if (titleTouched || linkType !== "item" || !selectedItem) return;
    const segLabel = selectedSegments?.length === 1
      ? ` — ${selectedSegments[0].label}`
      : selectedSegments && selectedSegments.length > 1
        ? ` — ${t("library.segments", { count: selectedSegments.length })}`
        : "";
    setTitle(`${selectedItem.title}${segLabel}`);
  }, [linkType, itemId, segmentIdsKey, selectedItem, selectedSegments, titleTouched, t]);

  // Auto-fill title from collection
  useEffect(() => {
    if (titleTouched || linkType !== "collection" || !selectedCollection) return;
    setTitle(selectedCollection.name);
  }, [linkType, collectionId, selectedCollection, titleTouched]);

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
    if (plan.some((entry) => entry.bpm !== undefined && !bpmSchema.safeParse(entry.bpm).success)) e.push(t("errors.bpmRange"));
    if (rec.enabled) {
      if (rec.kind === "weekdays" && !rec.days.length) e.push(t("errors.pickOneDay"));
      if (rec.kind === "interval" && (rec.everyX < 1 || rec.everyX > 60)) e.push(t("errors.intervalRange"));
      if (rec.endMode === "date" && !rec.endDate) e.push(t("errors.setEndDate"));
      if (rec.endMode === "nextLesson" && !nextLessonDateValue) e.push(t("errors.noUpcomingLesson"));
      if (rec.endMode === "count" && (rec.occurrences < 1 || rec.occurrences > 200)) e.push(t("errors.occurrencesRange"));
    }
    return e;
  }, [subjectId, linkType, itemId, collectionId, title, plan, rec, nextLessonDateValue, t]);

  const handleCancel = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  // Problems are listed only after a save attempt, then focused so the musician sees what is missing.
  const [tempoRule,setTempoRule] = useState<TempoProgressionRule>();
  const [tempoValid,setTempoValid] = useState(true);
  const [saving,setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const save = async () => {
    if (saving) return;
    if (errors.length || (rec.enabled && !tempoValid) || subjectId === undefined) {
      setAttempted(true);
      const first = !subjectId ? "task-subject" : !title.trim() ? "task-title" : "task-errors";
      requestAnimationFrame(() => document.getElementById(first)?.focus());
      return;
    }
    const baseTask = {
      subjectId,
      linkType,
      itemId: linkType === "item" ? itemId : undefined,
      collectionId: linkType === "collection" ? collectionId : undefined,
      title: title.trim(),
      plan,
      importance,
      executionNotes: executionNotes.trim() || undefined,
    };
    try {
      setSaving(true);
      if (recurrence && tempoRule) tempoRuleSchema.parse(tempoRule);
      const firstId = await tasksService.create({
        ...baseTask,
        date: recurrence ? recurrence.startDate : rec.startDate,
        recurrence,
        tempoRule: recurrence ? tempoRule : undefined,
      });
      if (prefill?.assignmentId) {
        await lessonsService.linkTask(prefill.assignmentId, firstId);
      }
      toast.success(recurrence ? t("toast.recurringTaskCreated") : t("toast.taskAdded"));
      handleCancel();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSaving(false); }
  };

  const sectionCls = "mt-6 border-t border-border pt-6";
  const labelCls = "text-xs font-medium";

  return (
    <div className="pb-24">
      <PageHeader
        title={t("tasks.newTask")}
        actions={<Button variant="outline" onClick={handleCancel}><ChevronLeft />{t("common.back")}</Button>}
      />

      <form
        onSubmit={(e) => { e.preventDefault(); void save(); }}
        className="min-w-0 max-w-[920px] rounded-lg bg-card p-4 shadow-soft sm:p-6 [&_input]:min-w-0 [&_textarea]:min-w-0"
      >
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="task-subject" className={labelCls}>{t("common.subject")}</Label>
            <Select
              value={subjectId?.toString() ?? ""}
              onValueChange={(v) => {
                setSubjectId(Number(v));
                setItemId(undefined); setSegmentIds([]); setCollectionId(undefined);
              }}
            >
              <SelectTrigger id="task-subject" aria-invalid={(attempted && !subjectId) || undefined} aria-describedby={attempted && !subjectId ? "task-errors" : undefined}><SelectValue placeholder={t("tasks.pickSubject")} /></SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="task-title" className={labelCls}>{t("common.title")}</Label>
            <Input id="task-title" value={title} onChange={(e) => { setTitleTouched(true); setTitle(e.target.value); }} placeholder={t("tasks.taskTitle")}
              aria-invalid={(attempted && !title.trim()) || undefined} aria-describedby={attempted && !title.trim() ? "task-errors" : undefined} />
          </div>
          {!rec.enabled && (
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="task-date" className={labelCls}>{t("common.date")}</Label>
              <Input id="task-date" type="date" required value={rec.startDate} onChange={(e) => setRec({ startDate: e.target.value })} />
            </div>
          )}
        </div>

        <div className={sectionCls}>
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
        </div>

        {plan.length > 0 && (
          <div className={sectionCls}>
            <PlanEditor plan={plan} onChange={setPlan} sections={selectedSegments} subject={selectedSubject} />
          </div>
        )}

        <div className={`${sectionCls} grid gap-1.5`}>
          <Label htmlFor="task-importance" className={labelCls}>{t("importance.label")}</Label>
          <ImportanceSelect id="task-importance" value={importance} onChange={setImportance} />
        </div>

        <div className={`${sectionCls} grid gap-1.5`}>
          <Label htmlFor="task-notes" className={labelCls}>{t("tasks.executionNotes")}</Label>
          <Textarea
            id="task-notes"
            value={executionNotes}
            onChange={(e) => setExecutionNotes(e.target.value)}
            placeholder={t("tasks.executionNotesPlaceholder")}
            rows={3}
          />
        </div>

        <div className={sectionCls}>
          <RecurrenceFields state={rec} setState={setRec} nextLessonDate={nextLessonDateValue} />
        </div>

        {rec.enabled && <TempoProgressionFields value={tempoRule} onChange={setTempoRule} onValidityChange={setTempoValid} disabled={saving} />}
        <FormErrors id="task-errors" errors={attempted ? errors : []} className="mt-6" />

        <FloatingActions className="flex-wrap min-[700px]:max-w-[920px] [&>button]:h-auto [&>button]:min-h-11 [&>button]:min-w-0 [&>button]:whitespace-normal">
          <Button type="button" variant="ghost" onClick={handleCancel}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={saving || (rec.enabled && !tempoValid)}>{t("tasks.addTask")}</Button>
        </FloatingActions>
      </form>
    </div>
  );
}

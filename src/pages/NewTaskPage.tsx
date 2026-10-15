import { useEffect, useMemo, useState } from "react";
import { useCollection, useItem, useLessons, useRecurrences, useSegmentsByIds, useSubjects } from "@/presentation/hooks/useEntities";
import { useNavigate, useLocation } from "react-router-dom";
import type { TaskLinkType } from "@/domain/entities/task";
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
import { useTaskPlan } from "@/components/diary/useTaskPlan";
import { LinkTargetFields } from "@/components/diary/LinkTargetFields";
import { RecurrenceFields } from "@/components/diary/RecurrenceFields";
import { buildRecurrence, type RecurrenceState } from "@/components/diary/recurrence-state";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormErrors } from "@/components/shared/StateNotice";

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
  const [title, setTitle] = useState(prefill?.itemTitle ?? prefill?.title ?? "");
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
    if (linkType !== "item" || !selectedItem) return;
    const segLabel = selectedSegments?.length === 1
      ? ` — ${selectedSegments[0].label}`
      : selectedSegments && selectedSegments.length > 1
        ? ` — ${selectedSegments.length} segments`
        : "";
    setTitle(`${selectedItem.title}${segLabel}`);
  }, [linkType, itemId, segmentIdsKey, selectedItem, selectedSegments]);

  // Auto-fill title from collection
  useEffect(() => {
    if (linkType !== "collection" || !selectedCollection) return;
    setTitle(selectedCollection.name);
  }, [linkType, collectionId, selectedCollection]);

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
    if (plan.some((entry) => entry.bpm !== undefined && (entry.bpm < 20 || entry.bpm > 400))) e.push(t("errors.bpmRange"));
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

  const save = async () => {
    if (errors.length || subjectId === undefined) return;
    const baseTask = {
      subjectId,
      linkType,
      itemId: linkType === "item" ? itemId : undefined,
      collectionId: linkType === "collection" ? collectionId : undefined,
      title: title.trim(),
      plan,
      executionNotes: executionNotes.trim() || undefined,
    };
    try {
      const firstId = await tasksService.create({
        ...baseTask,
        date: recurrence ? recurrence.startDate : date,
        recurrence,
      });
      if (prefill?.assignmentId) {
        await lessonsService.linkTask(prefill.assignmentId, firstId);
      }
      toast.success(recurrence ? t("toast.recurringTaskCreated") : t("toast.taskAdded"));
      handleCancel();
    } catch (err) {
      toast.error((err as Error).message);
    }
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
        className="max-w-[920px] rounded-[14px] bg-card p-6 shadow-soft"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className={labelCls}>{t("teacher.subject")}</Label>
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
          <div className="grid gap-1.5">
            <Label className={labelCls}>{t("common.title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("tasks.taskTitle")} />
          </div>
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

        <div className={sectionCls}>
          <PlanEditor plan={plan} onChange={setPlan} sections={selectedSegments} subject={selectedSubject} />
        </div>

        <div className={`${sectionCls} grid gap-1.5`}>
          <Label className={labelCls}>{t("tasks.executionNotes")}</Label>
          <Textarea
            value={executionNotes}
            onChange={(e) => setExecutionNotes(e.target.value)}
            placeholder={t("tasks.executionNotesPlaceholder")}
            rows={3}
          />
        </div>

        <div className={sectionCls}>
          <RecurrenceFields state={rec} setState={setRec} nextLessonDate={nextLessonDateValue} />
        </div>

        <FormErrors errors={errors} className="mt-6" />

        <div className="mt-8 flex justify-end gap-2 border-t border-border pt-5 max-[699px]:sticky max-[699px]:bottom-[calc(76px+env(safe-area-inset-bottom))] max-[699px]:bg-card max-[699px]:pb-3">
          <Button type="button" variant="ghost" onClick={handleCancel}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={errors.length > 0}>{t("tasks.addTask")}</Button>
        </div>
      </form>
    </div>
  );
}

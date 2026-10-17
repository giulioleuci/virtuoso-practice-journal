import { useMemo, useState } from "react";
import { useItem, useSegmentsByIds, useSubjects, useTask } from "@/presentation/hooks/useEntities";
import { useNavigate, useParams } from "react-router-dom";
import type { Task, TaskLinkType } from "@/domain/entities/task";
import { planSegmentIds } from "@/domain/logic/plan";
import { tasksService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
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
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormErrors } from "@/components/shared/StateNotice";
import { ChevronLeft } from "lucide-react";

export default function EditTaskPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const task = useTask(id ? Number(id) : undefined);

  if (task === undefined) {
    return (
      <div className="space-y-4">
        <div className="paper-skeleton h-10 w-48" />
        <div className="paper-skeleton h-12 w-full" />
        <div className="paper-skeleton h-12 w-full" />
        <div className="paper-skeleton h-12 w-full" />
      </div>
    );
  }
  if (task === null) return <EmptyState title={t("tasks.notFound")} />;
  return <EditTaskForm key={task.id} task={task} />;
}

function EditTaskForm({ task }: { task: Task }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const subjects = useSubjects();

  const [subjectId, setSubjectId] = useState<number | undefined>(task.subjectId);
  const [linkType, setLinkType] = useState<TaskLinkType>(task.linkType ?? (task.collectionId ? "collection" : task.itemId ? "item" : "free"));
  const [itemId, setItemId] = useState<number | undefined>(task.itemId);
  const [segmentIds, setSegmentIds] = useState<number[]>(planSegmentIds(task.plan));
  const [collectionId, setCollectionId] = useState<number | undefined>(task.collectionId);
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date);
  const [executionNotes, setExecutionNotes] = useState(task.executionNotes ?? "");

  const selectedSubject = useMemo(() => subjects?.find((s) => s.id === subjectId), [subjects, subjectId]);
  const item = useItem(itemId);
  const sections = useSegmentsByIds(segmentIds);
  const [plan, setPlan] = useTaskPlan(task.plan, { linkType, itemId, segmentIds }, item, sections, selectedSubject);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!subjectId) e.push(t("errors.pickSubject"));
    if (!title.trim()) e.push(t("errors.titleRequired"));
    if (!date) e.push(t("errors.dateRequired"));
    if (linkType === "item" && !itemId) e.push(t("errors.pickItem"));
    if (linkType === "collection" && !collectionId) e.push(t("errors.pickCollection"));
    if (plan.some((entry) => entry.bpm !== undefined && (entry.bpm < 20 || entry.bpm > 400))) e.push(t("errors.bpmRange"));
    return e;
  }, [subjectId, title, date, plan, linkType, itemId, collectionId, t]);

  const handleCancel = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/tasks");
  };

  const save = async () => {
    if (!task.id || errors.length || subjectId === undefined) return;
    await tasksService.update(task.id, {
      subjectId,
      linkType,
      itemId: linkType === "item" ? itemId : undefined,
      collectionId: linkType === "collection" ? collectionId : undefined,
      title: title.trim(), date, plan,
      executionNotes: executionNotes.trim() || undefined,
      ...(task.studyRoutineId !== undefined ? { customized: true } : {}),
    });
    toast.success(t("toast.taskUpdated"));
    handleCancel();
  };

  const sectionCls = "mt-6 border-t border-border pt-6";
  const labelCls = "text-xs font-medium";

  return (
    <div className="pb-24">
      <PageHeader
        title={t("tasks.editTask")}
        actions={<Button variant="outline" onClick={handleCancel}><ChevronLeft />{t("common.back")}</Button>}
      />

      <form
        onSubmit={(e) => { e.preventDefault(); void save(); }}
        className="max-w-[920px] rounded-[14px] bg-card p-6 shadow-soft"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className={labelCls}>{t("common.date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className={labelCls}>{t("common.subject")}</Label>
            <Select
              value={subjectId?.toString() ?? ""}
              onValueChange={(v) => { setSubjectId(Number(v)); setItemId(undefined); setSegmentIds([]); setCollectionId(undefined); }}
            >
              <SelectTrigger><SelectValue placeholder={t("tasks.pickSubject")} /></SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label className={labelCls}>{t("common.title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
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
          <PlanEditor plan={plan} onChange={setPlan} sections={sections} subject={selectedSubject} />
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

        <FormErrors errors={errors} className="mt-6" />

        <div className="mt-8 flex justify-end gap-2 border-t border-border pt-5 max-[699px]:sticky max-[699px]:bottom-[var(--floating-bottom)] max-[699px]:bg-card max-[699px]:pb-3">
          <Button type="button" variant="ghost" onClick={handleCancel}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={errors.length > 0}>{t("common.save")}</Button>
        </div>
      </form>
    </div>
  );
}

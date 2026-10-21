import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAssignmentsForLesson, useLessons, useRecurrences, useSubjects } from "@/presentation/hooks/useEntities";
import { lessonsService } from "@/lib/services";
import { clearLiveLesson, setLiveLesson } from "@/lib/liveLesson";
import { today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/Loading";
import { LessonEntryList } from "@/components/lessons/LessonEntryList";
import { LessonExtraActions } from "@/components/lessons/LessonExtraActions";

/** A lesson kept open from start to end: homework and notes are saved as they are typed. */
export default function LessonLive() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const lessons = useLessons();
  const recurrences = useRecurrences();
  const subjects = useSubjects();
  const [dateError, setDateError] = useState<string>();

  // `?lesson=<id>` opens an existing lesson; `?recurrence=<id>|subject=<id>&date=` a slot whose row appears on the first write.
  const lessonParam = Number(params.get("lesson")) || undefined;
  const given = lessonParam ? lessons?.find((l) => l.id === lessonParam) : undefined;
  const recurrenceId = lessonParam ? given?.recurrenceId : Number(params.get("recurrence")) || undefined;
  const recurrence = recurrences?.find((r) => r.id === recurrenceId);
  const subjectId = given?.subjectId ?? recurrence?.subjectId ?? (Number(params.get("subject")) || undefined);
  const subject = subjects?.find((s) => s.id === subjectId);
  const date = given?.date ?? params.get("date") ?? today();
  const lesson = given ?? lessons?.find((l) => l.subjectId === subjectId && l.recurrenceId === recurrenceId && l.date === date);
  const assignments = useAssignmentsForLesson(lesson?.id);
  const loaded = lessons !== undefined && recurrences !== undefined && subjects !== undefined;
  const missing = loaded && (lessonParam ? !given : recurrenceId ? !recurrence : !subject);

  useEffect(() => { setLiveLesson(location.pathname + location.search); }, [location.pathname, location.search]);
  // A lesson or teacher deleted elsewhere: nothing left to resume.
  useEffect(() => { if (missing) { clearLiveLesson(); navigate("/lessons", { replace: true }); } }, [missing, navigate]);

  if (!loaded || missing || subjectId === undefined) return <PageSkeleton />;

  // Every write resolves the row first; ensureFor is atomic, so fast adds from both lists share one lesson.
  const lessonId = async () => given?.id ?? lessonsService.ensureFor(subjectId, recurrence, date);
  const scope = lessonParam ? `lesson-${lessonParam}` : `${recurrenceId ? `recurrence-${recurrenceId}` : `subject-${subjectId}`}-${date}`;

  const changeDate = async (next: string) => {
    if (!next || next === date) return;
    setDateError(undefined);
    const moveUrl = () => { if (lessonParam) return; const p = new URLSearchParams(params); p.set("date", next); setParams(p, { replace: true }); };
    if (!lesson?.id) return moveUrl();
    try { await lessonsService.setDate(lesson.id, next); moveUrl(); }
    catch (error) { setDateError(error instanceof Error && error.message === "lesson-exists" ? t("lessonLive.dateTaken") : t("errors.couldNotSave")); }
  };
  const finish = () => { clearLiveLesson(); navigate("/lessons"); };

  return (
    <div className="pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <PageHeader title={t("lessonLive.title")} actions={<Button className="min-h-11" onClick={finish}>{t("lessonLive.finish")}</Button>} />
      <div className="mb-8 space-y-3">
        <p className="break-words text-sm text-muted-foreground">{[recurrence?.teacher ?? lesson?.snapshot?.teacher, subject?.name ?? lesson?.snapshot?.subjectName].filter(Boolean).join(" · ")}</p>
        <Input type="date" required aria-label={t("common.date")} aria-invalid={!!dateError} value={date} onChange={(e) => void changeDate(e.target.value)} className="min-h-11 w-auto max-w-full" />
        {dateError && <p role="alert" className="text-sm text-destructive">{dateError}</p>}
        <LessonExtraActions subjectId={subjectId} />
      </div>
      <div className="space-y-8">
        <LessonEntryList key={`${scope}-homework`} draftScope={`${scope}-homework`} title={t("lessonLive.homework")} placeholder={t("homework.textPlaceholder")} addLabel={t("homework.add")}
          entries={assignments ?? []}
          onAdd={async (text) => lessonsService.addAssignment(await lessonId(), text)}
          onEdit={(id, text) => lessonsService.updateAssignment(Number(id), text)}
          onRemove={(id) => lessonsService.removeAssignment(Number(id))}
          onRestore={async (text) => lessonsService.addAssignment(await lessonId(), text)} />
        <LessonEntryList key={`${scope}-notes`} draftScope={`${scope}-notes`} title={t("lessonLive.notes")} placeholder={t("lessonLive.notePlaceholder")} addLabel={t("lessonLive.addNote")}
          entries={lesson?.notes ?? []}
          onAdd={async (text) => lessonsService.addNote(await lessonId(), text)}
          onEdit={async (id, text) => lessonsService.updateNote(await lessonId(), String(id), text)}
          onRemove={async (id) => lessonsService.removeNote(await lessonId(), String(id))}
          onRestore={async (text) => lessonsService.addNote(await lessonId(), text)} />
      </div>
    </div>
  );
}
